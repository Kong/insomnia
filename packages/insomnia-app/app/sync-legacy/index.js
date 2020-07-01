import * as db from '../common/database';
import * as models from '../models';
import * as store from './storage';
import * as misc from '../common/misc';
import Logger from './logger';
import * as zlib from 'zlib';
import {
  syncCreateResourceGroup,
  syncFixDupes,
  syncGetResourceGroup,
  syncPull,
  syncPush,
  syncResetData,
} from './network';
import * as crypt from '../account/crypt';
import * as session from '../account/session';

export const START_DELAY = 1e3;
export const PULL_PERIOD = 15e3;
export const WRITE_PERIOD = 1e3;

const WHITE_LIST = {
  [models.workspace.type]: true,
  [models.request.type]: true,
  [models.requestGroup.type]: true,
  [models.environment.type]: true,
  [models.unitTest.type]: true,
  [models.unitTestSuite.type]: true,

  // These can be overridden in sync config
  [models.cookieJar.type]: true,
  [models.clientCertificate.type]: true,
};

export const logger = new Logger();

// TODO: Move this stuff somewhere else
const NO_VERSION = '__NO_VERSION__';
const resourceGroupSymmetricKeysCache = {};
let _pullChangesInterval = null;
let _writeChangesInterval = null;
let _pendingDBChanges = {};
let _isInitialized = false;

// Used to mark whether or not the new sync system is enabled
let _disabledForSession = false;

export function disableForSession() {
  _disabledForSession = true;
}

export async function init() {
  if (_disabledForSession) {
    logger.debug('Legacy sync is disabled for current session');
    return;
  }

  if (_isInitialized) {
    logger.debug('Already enabled');
    return;
  }

  // NOTE: This is at the top to prevent race conditions
  _isInitialized = true;
  db.onChange(async changes => {
    // To help prevent bugs, put Workspaces first
    const sortedChanges = changes.sort(([event, doc, fromSync]) =>
      doc.type === models.workspace.type ? 1 : -1,
    );

    for (const [event, doc, fromSync] of sortedChanges) {
      const notOnWhitelist = !WHITE_LIST[doc.type];
      const notLoggedIn = !session.isLoggedIn();

      if (doc.isPrivate) {
        logger.debug(`Skip private doc change ${doc._id}`);
        continue;
      }

      if (notLoggedIn || notOnWhitelist || fromSync) {
        continue;
      }

      const key = `${event}:${doc._id}`;
      _pendingDBChanges[key] = [event, doc, Date.now()];
    }
  });

  await misc.delay(START_DELAY);

  await push();
  await pull();

  let nextSyncTime = 0;
  let isSyncing = false;
  _pullChangesInterval = setInterval(async () => {
    if (isSyncing) {
      return;
    }

    if (Date.now() < nextSyncTime) {
      return;
    }

    // Mark that we are currently executing a sync op
    isSyncing = true;

    const syncStartTime = Date.now();

    let extraDelay = 0;
    try {
      await push();
      await pull();
    } catch (err) {
      logger.error('Sync failed with', err);
      extraDelay += PULL_PERIOD;
    }

    const totalSyncTime = Date.now() - syncStartTime;

    // Add sync duration to give the server some room if it's being slow.
    // Also, multiply it by a random value so everyone doesn't sync up
    extraDelay += totalSyncTime * (Math.random() * 2);

    nextSyncTime = Date.now() + PULL_PERIOD + extraDelay;
    isSyncing = false;
  }, PULL_PERIOD / 5);

  _writeChangesInterval = setInterval(writePendingChanges, WRITE_PERIOD);

  logger.debug('Initialized');
}

// Used only during tests!
export function _testReset() {
  _isInitialized = false;
  clearInterval(_pullChangesInterval);
  clearInterval(_writeChangesInterval);
}

/**
 * Non-blocking function to perform initial sync for an account. This will pull
 * all remote resources (if they exist) before initializing sync.
 */
export function doInitialSync() {
  process.nextTick(async () => {
    // First, pull down all remote resources, without first creating new ones.
    // This makes sure that the first sync won't create resources locally, when
    // they already exist on the server.
    await pull(null, false);

    // Make sure sync is on (start the timers)
    await init();
  });
}

/**
 * This is a function to clean up Workspaces that might have had more than one
 * ResourceGroup created for them. This function should be called on init (or maybe
 * even periodically) and can be removed once the bug stops persisting.
 */
export async function fixDuplicateResourceGroups() {
  if (!session.isLoggedIn()) {
    return;
  }

  let duplicateCount = 0;
  const workspaces = await models.workspace.all();
  for (const workspace of workspaces) {
    const resources = await store.findResourcesByDocId(workspace._id);

    // No duplicates found
    if (resources.length <= 1) {
      continue;
    }

    // Fix duplicates
    const ids = resources.map(r => r.resourceGroupId);
    const { deleteResourceGroupIds } = await syncFixDupes(ids);

    for (const idToDelete of deleteResourceGroupIds) {
      await store.removeResourceGroup(idToDelete);
    }

    duplicateCount++;
  }

  if (duplicateCount) {
    logger.debug(`Fixed ${duplicateCount}/${workspaces.length} duplicate synced Workspaces`);
  }
}

export async function writePendingChanges() {
  // First make a copy and clear pending changes
  const changes = Object.assign({}, _pendingDBChanges);
  _pendingDBChanges = {};

  const keys = Object.keys(changes);

  if (keys.length === 0) {
    // No changes, just return
    return;
  }

  for (const key of Object.keys(changes)) {
    const [event, doc, timestamp] = changes[key];
    await _handleChangeAndPush(event, doc, timestamp);
  }
}

export async function push(resourceGroupId = null) {
  if (_disabledForSession) {
    logger.debug('Legacy sync is disabled for current session');
    return;
  }

  if (!session.isLoggedIn()) {
    return;
  }

  let allDirtyResources = [];
  if (resourceGroupId) {
    allDirtyResources = await store.findActiveDirtyResourcesForResourceGroup(resourceGroupId);
  } else {
    allDirtyResources = await store.findActiveDirtyResources();
  }

  if (!allDirtyResources.length) {
    // No changes to push
    return;
  }

  const dirtyResources = [];
  for (const r of allDirtyResources) {
    // Check if resource type is blacklisted by user
    const config = await store.getConfig(r.resourceGroupId);

    if (r.type === models.clientCertificate.type && config.syncDisableClientCertificates) {
      logger.debug(`Skipping pushing blacklisted client certificate ${r.id}`);
      continue;
    }

    if (r.type === models.cookieJar.type && config.syncDisableCookieJars) {
      logger.debug(`Skipping pushing blacklisted cookie jar ${r.id}`);
      continue;
    }

    dirtyResources.push(r);
  }

  let responseBody;
  try {
    responseBody = await syncPush(dirtyResources);
  } catch (e) {
    logger.error('Failed to push changes', e);
    return;
  }

  const { updated, created, removed, conflicts } = responseBody;

  // Update all resource versions with the ones that were returned
  for (const { id, version } of updated) {
    const resource = await store.getResourceByDocId(id);
    await store.updateResource(resource, { version, dirty: false });
  }
  if (updated.length) {
    logger.debug(`Push updated ${updated.length} resources`);
  }

  // Update all resource versions with the ones that were returned
  for (const { id, version } of created) {
    const resource = await store.getResourceByDocId(id);
    await store.updateResource(resource, { version, dirty: false });
  }
  if (created.length) {
    logger.debug(`Push created ${created.length} resources`);
  }

  // Update all resource versions with the ones that were returned
  for (const { id, version } of removed) {
    const resource = await store.getResourceByDocId(id);
    await store.updateResource(resource, { version, dirty: false });
  }
  if (removed.length) {
    logger.debug(`Push removed ${removed.length} resources`);
  }

  // Resolve conflicts
  await db.bufferChanges();
  for (const serverResource of conflicts) {
    const localResource = await store.getResourceByDocId(
      serverResource.id,
      serverResource.resourceGroupId,
    );

    // On conflict, choose last edited one
    const serverIsNewer = serverResource.lastEdited > localResource.lastEdited;
    const winner = serverIsNewer ? serverResource : localResource;

    // Update local resource
    // NOTE: using localResource as the base to make sure we have _id
    await store.updateResource(localResource, winner, {
      version: serverResource.version, // Act as the server resource no matter what
      dirty: !serverIsNewer, // It's dirty if we chose the local doc
    });

    // Decrypt the docs from the resources. Don't fetch the local doc from the
    // app database, because it might have been deleted.
    const winnerName = serverIsNewer ? 'Server' : 'Local';
    logger.debug(`Resolved conflict for ${serverResource.id} (${winnerName})`);

    // If the server won, update ourselves. If we won, we already have the
    // latest version, so do nothing.
    if (serverIsNewer) {
      const doc = await decryptDoc(winner.resourceGroupId, winner.encContent);
      if (winner.removed) {
        await db.remove(doc, true);
      } else {
        await db.update(doc, true);
      }
    }
  }

  db.flushChangesAsync();
}

export async function pull(resourceGroupId = null, createMissingResources = true) {
  if (_disabledForSession) {
    logger.debug('Legacy sync is disabled for current session');
    return;
  }

  if (!session.isLoggedIn()) {
    return;
  }

  // Try to fix duplicates first. Don't worry if this is called a lot since if there
  // are no duplicates found it doesn't contact the network.
  await fixDuplicateResourceGroups();

  let allResources;
  if (createMissingResources) {
    allResources = await getOrCreateAllActiveResources(resourceGroupId);
  } else {
    allResources = await store.allActiveResources(resourceGroupId);
  }

  let blacklistedConfigs;
  if (resourceGroupId) {
    // When doing specific sync, blacklist all configs except the one we're trying to sync.
    const allConfigs = await store.allConfigs();
    blacklistedConfigs = allConfigs.filter(c => c.resourceGroupId !== resourceGroupId);
  } else {
    // When doing a full sync, blacklist the inactive configs
    blacklistedConfigs = await store.findInactiveConfigs(resourceGroupId);
  }

  const resources = allResources.map(r => ({
    id: r.id,
    resourceGroupId: r.resourceGroupId,
    version: r.version,
    removed: r.removed,
  }));

  const blacklistedResourceGroupIds = blacklistedConfigs.map(c => c.resourceGroupId);

  const body = {
    resources,
    blacklist: blacklistedResourceGroupIds,
  };

  if (resources.length) {
    logger.debug(`Pulling with ${resources.length} resources`);
  }

  let responseBody;
  try {
    responseBody = await syncPull(body);
  } catch (e) {
    logger.error('Failed to sync changes', e, body);
    return;
  }

  const { updatedResources, createdResources, idsToPush, idsToRemove } = responseBody;

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Insert all the created docs to the DB //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  await db.bufferChanges();
  for (const serverResource of createdResources) {
    let doc;

    try {
      const { resourceGroupId, encContent } = serverResource;
      doc = await decryptDoc(resourceGroupId, encContent);
    } catch (e) {
      logger.warn('Failed to decode created resource', e, serverResource);
      return;
    }

    // Check if resource type is blacklisted by user
    const config = await store.getConfig(serverResource.resourceGroupId);

    if (
      serverResource.type === models.clientCertificate.type &&
      config.syncDisableClientCertificates
    ) {
      logger.debug(`[sync] Skipping pulling blacklisted client certificate ${serverResource.id}`);
      continue;
    }

    if (serverResource.type === models.cookieJar.type && config.syncDisableCookieJars) {
      logger.debug(`[sync] Skipping pulling blacklisted cookie jar ${serverResource.id}`);
      continue;
    }

    // Update local Resource
    try {
      await store.insertResource(serverResource, { dirty: false });
    } catch (e) {
      // This probably means we already have it. This should never happen, but
      // might due to a rare race condition.
      logger.error('Failed to insert resource', e, serverResource);
      return;
    }

    // NOTE: If the above Resource insert succeeded, that means we have safely
    // insert the document. However, we're using an upsert here instead because
    // it's very possible that the client already had that document locally.
    // This might happen, for example, if the user logs out and back in again.
    const existingDoc = await db.get(doc.type, doc._id);
    if (existingDoc) {
      await db.update(doc, true);
    } else {
      // Mark as not seen if we created a new workspace from sync
      if (doc.type === models.workspace.type) {
        const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(doc._id);
        await models.workspaceMeta.update(workspaceMeta, { hasSeen: false });
      }
      await db.insert(doc, true);
    }
  }

  if (createdResources.length) {
    logger.debug(`Pull created ${createdResources.length} resources`);
  }

  db.flushChangesAsync();

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Save all the updated docs to the DB //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  await db.bufferChanges();
  for (const serverResource of updatedResources) {
    try {
      const { resourceGroupId, encContent } = serverResource;
      const doc = await decryptDoc(resourceGroupId, encContent);

      // Update app database
      // Needs to be upsert because we could be "undeleting" something
      await db.upsert(doc, true);

      // Update local resource
      const resource = await store.getResourceByDocId(
        serverResource.id,
        serverResource.resourceGroupId,
      );
      await store.updateResource(resource, serverResource, { dirty: false });
    } catch (e) {
      logger.warn('Failed to decode updated resource', e, serverResource);
    }
  }
  db.flushChangesAsync();

  if (updatedResources.length) {
    logger.debug(`Pull updated ${updatedResources.length} resources`);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Remove all the docs that need removing //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  await db.bufferChanges();
  for (const id of idsToRemove) {
    const resource = await store.getResourceByDocId(id);
    if (!resource) {
      throw new Error(`Could not find Resource to remove for ${id}`);
    }

    const doc = await decryptDoc(resource.resourceGroupId, resource.encContent);
    if (!doc) {
      throw new Error(`Could not find doc to remove ${id}`);
    }

    // Mark resource as deleted
    await store.updateResource(resource, { dirty: false, removed: true });

    // Remove from DB
    await db.remove(doc, true);
  }
  db.flushChangesAsync();

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Push all the docs that need pushing //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  for (const id of idsToPush) {
    const resource = await store.getResourceByDocId(id);
    if (!resource) {
      throw new Error(`Could not find Resource to push for id ${id}`);
    }

    // Mark all resources to push as dirty for the next push
    await store.updateResource(resource, { dirty: true });
  }

  return updatedResources.length + createdResources.length;
}

export async function getOrCreateConfig(resourceGroupId) {
  const config = await store.getConfig(resourceGroupId);

  if (!config) {
    return store.insertConfig({ resourceGroupId });
  } else {
    return config;
  }
}

export async function ensureConfigExists(resourceGroupId, syncMode) {
  const config = await store.getConfig(resourceGroupId);
  if (!config) {
    await store.insertConfig({ resourceGroupId, syncMode });
  }
}

export async function createOrUpdateConfig(resourceGroupId, patch) {
  const config = await store.getConfig(resourceGroupId);
  const finalPatch = { resourceGroupId, ...patch };

  if (config) {
    return store.updateConfig(config, finalPatch);
  } else {
    return store.insertConfig(finalPatch);
  }
}

export async function logout() {
  await session.logout();
  await resetLocalData();
}

export async function cancelTrial() {
  await session.endTrial();
  await session.logout();
  await resetLocalData();
}

export async function resetLocalData() {
  for (const c of await store.allConfigs()) {
    await store.removeConfig(c);
  }

  for (const r of await store.allResources()) {
    await store.removeResource(r);
  }
}

export async function resetRemoteData() {
  await syncResetData();
}

// ~~~~~~~ //
// HELPERS //
// ~~~~~~~ //

async function _handleChangeAndPush(event, doc, timestamp) {
  // Update the resource content and set dirty
  // TODO: Remove one of these steps since it does encryption twice
  // in the case where the resource does not exist yet
  const resource = await getOrCreateResourceForDoc(doc);

  const updatedResource = await store.updateResource(resource, {
    name: doc.name || 'n/a',
    lastEdited: timestamp,
    lastEditedBy: session.getAccountId(),
    encContent: await encryptDoc(resource.resourceGroupId, doc),
    removed: event === db.CHANGE_REMOVE,
    dirty: true,
  });

  // Debounce pushing of dirty resources
  logger.debug(`Queue ${event} ${updatedResource.id}`);
}

/**
 * Fetch a ResourceGroup. If it has been fetched before, lookup from memory
 *
 * @param resourceGroupId
 * @returns {*}
 */
const _fetchResourceGroupPromises = {};
const _resourceGroupCache = {};

export async function fetchResourceGroup(resourceGroupId, invalidateCache = false) {
  if (invalidateCache) {
    delete _resourceGroupCache[resourceGroupId];
    delete _fetchResourceGroupPromises[resourceGroupId];
  }

  // PERF: If we're currently fetching, return stored promise
  // TODO: Maybe move parallel fetch caching into the fetch helper
  if (_fetchResourceGroupPromises[resourceGroupId]) {
    return _fetchResourceGroupPromises[resourceGroupId];
  }

  const promise = new Promise(async (resolve, reject) => {
    let resourceGroup = _resourceGroupCache[resourceGroupId];

    if (!resourceGroup) {
      try {
        resourceGroup = await syncGetResourceGroup(resourceGroupId);
      } catch (e) {
        if (e.statusCode === 404) {
          await store.removeResourceGroup(resourceGroupId);
          logger.debug('ResourceGroup not found. Deleting...');
          reject(new Error('ResourceGroup was not found'));
          return;
        } else {
          logger.error(`Failed to get ResourceGroup ${resourceGroupId}: ${e}`);
          reject(e);
          return;
        }
      }

      if (resourceGroup.isDisabled) {
        await store.removeResourceGroup(resourceGroup.id);
        logger.debug('ResourceGroup was disabled. Deleting...');
        reject(new Error('ResourceGroup was disabled'));
        return;
      }

      // Also make sure a config exists when we first fetch it.
      // (This may not be needed but we'll do it just in case)
      await ensureConfigExists(resourceGroupId);
    }

    // Bust cached promise because we're done with it.
    _fetchResourceGroupPromises[resourceGroupId] = null;

    // Cache the ResourceGroup for next time (they never change)
    _resourceGroupCache[resourceGroupId] = resourceGroup;

    // Return the ResourceGroup
    resolve(resourceGroup);
  });

  // Cache the Promise in case we get asked for the same thing before done
  _fetchResourceGroupPromises[resourceGroupId] = promise;
  return promise;
}

/**
 * Get a ResourceGroup's symmetric encryption key
 *
 * @param resourceGroupId
 * @private
 */
async function _getResourceGroupSymmetricKey(resourceGroupId) {
  let key = resourceGroupSymmetricKeysCache[resourceGroupId];

  if (!key) {
    const resourceGroup = await fetchResourceGroup(resourceGroupId);
    const accountPrivateKey = await session.getPrivateKey();

    const symmetricKeyStr = crypt.decryptRSAWithJWK(
      accountPrivateKey,
      resourceGroup.encSymmetricKey,
    );

    key = JSON.parse(symmetricKeyStr);

    // Update cache
    resourceGroupSymmetricKeysCache[resourceGroupId] = key;
  }

  return key;
}

export async function encryptDoc(resourceGroupId, doc) {
  try {
    const symmetricKey = await _getResourceGroupSymmetricKey(resourceGroupId);

    // TODO: Turn on compression once enough users are on version >= 5.7.0
    // const jsonStr = JSON.stringify(doc);
    // const docStr = zlib.gzipSync(jsonStr);

    // Don't use compression for now
    const docStr = JSON.stringify(doc);

    const message = crypt.encryptAES(symmetricKey, docStr);
    return JSON.stringify(message);
  } catch (e) {
    logger.error(`Failed to encrypt for ${resourceGroupId}: ${e}`);
    throw e;
  }
}

export async function decryptDoc(resourceGroupId, messageJSON) {
  let decrypted;
  try {
    const symmetricKey = await _getResourceGroupSymmetricKey(resourceGroupId);
    const message = JSON.parse(messageJSON);
    decrypted = crypt.decryptAES(symmetricKey, message);
  } catch (e) {
    logger.error(`Failed to decrypt from ${resourceGroupId}: ${e}`, messageJSON);
    throw e;
  }

  try {
    decrypted = zlib.gunzipSync(decrypted);
  } catch (err) {
    // It's not compressed (legacy), which is okay for now
  }

  try {
    return JSON.parse(decrypted);
  } catch (e) {
    logger.error(`Failed to parse after decrypt from ${resourceGroupId}: ${e}`, decrypted);
    throw e;
  }
}

async function _getWorkspaceForDoc(doc) {
  const ancestors = await db.withAncestors(doc);
  return ancestors.find(d => d.type === models.workspace.type);
}

export async function createResourceGroup(parentId, name) {
  // Generate symmetric key for ResourceGroup
  const rgSymmetricJWK = await crypt.generateAES256Key();
  const rgSymmetricJWKStr = JSON.stringify(rgSymmetricJWK);

  // Encrypt the symmetric key with Account public key
  const publicJWK = session.getPublicKey();
  const encRGSymmetricJWK = crypt.encryptRSAWithJWK(publicJWK, rgSymmetricJWKStr);

  // Create the new ResourceGroup
  let resourceGroup;
  try {
    resourceGroup = await syncCreateResourceGroup(parentId, name, encRGSymmetricJWK);
  } catch (e) {
    logger.error(`Failed to create ResourceGroup: ${e}`);
    throw e;
  }

  // Create a config for it
  await ensureConfigExists(resourceGroup.id, store.SYNC_MODE_UNSET);

  logger.debug(`Created ResourceGroup ${resourceGroup.id}`);
  return resourceGroup;
}

export async function createResource(doc, resourceGroupId) {
  return store.insertResource({
    id: doc._id,
    name: doc.name || 'n/a', // Set name to the doc name if it has one
    resourceGroupId: resourceGroupId,
    version: NO_VERSION,
    createdBy: session.getAccountId(),
    lastEdited: doc.modified,
    lastEditedBy: session.getAccountId(),
    removed: false,
    type: doc.type,
    encContent: await encryptDoc(resourceGroupId, doc),
    dirty: true,
  });
}

export async function createResourceForDoc(doc) {
  // No resource yet, so create one
  const workspace = await _getWorkspaceForDoc(doc);

  if (!workspace) {
    // Workspace was probably deleted before it's children could be synced.
    // TODO: Handle this case better
    throw new Error(`Could not find workspace for doc ${doc._id}`);
  }

  let workspaceResource = await store.getResourceByDocId(workspace._id);

  if (!workspaceResource) {
    const workspaceResourceGroup = await createResourceGroup(workspace._id, workspace.name);
    workspaceResource = await createResource(workspace, workspaceResourceGroup.id);
  }

  if (workspace === doc) {
    // If the current doc IS a Workspace, just return it
    return workspaceResource;
  } else {
    return createResource(doc, workspaceResource.resourceGroupId);
  }
}

export async function getOrCreateResourceForDoc(doc) {
  const [resource, ...extras] = await store.findResourcesByDocId(doc._id);

  // Sometimes there may be multiple resources created by accident for
  // the same doc. Let's delete the extras here if there are any.
  for (const resource of extras) {
    await store.removeResource(resource);
  }

  if (resource) {
    return resource;
  } else {
    return createResourceForDoc(doc);
  }
}

export async function getOrCreateAllActiveResources(resourceGroupId = null) {
  const startTime = Date.now();
  const activeResourceMap = {};

  let activeResources;
  if (resourceGroupId) {
    activeResources = await store.activeResourcesForResourceGroup(resourceGroupId);
  } else {
    activeResources = await store.allActiveResources();
  }

  for (const r of activeResources) {
    activeResourceMap[r.id] = r;
  }

  // Make sure Workspace is first, because the loop below depends on it
  const modelTypes = Object.keys(WHITE_LIST).sort((a, b) =>
    a.type === models.workspace.type ? 1 : -1,
  );

  let created = 0;
  for (const type of modelTypes) {
    for (const doc of await db.all(type)) {
      if (doc.isPrivate) {
        // logger.debug(`Skip private doc ${doc._id}`);
        continue;
      }

      const resource = await store.getResourceByDocId(doc._id);
      if (!resource) {
        try {
          activeResourceMap[doc._id] = await createResourceForDoc(doc);
          created++;
        } catch (e) {
          // logger.warn(`Failed to create resource for ${doc._id} ${e}`, {doc});
        }
      }
    }
  }

  const resources = Object.keys(activeResourceMap).map(k => activeResourceMap[k]);

  const time = (Date.now() - startTime) / 1000;
  if (created > 0) {
    logger.debug(`Created ${created}/${resources.length} Resources (${time.toFixed(2)}s)`);
  }
  return resources;
}
