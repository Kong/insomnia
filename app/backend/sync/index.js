import * as db from '../database';
import * as util from './util';
import * as crypt from './crypt';
import * as session from './session';
import * as resourceStore from './storage';
import Logger from './logger';

export const FULL_SYNC_INTERVAL = 30E3;
export const DEBOUNCE_TIME = 5E3;
export const START_PULL_DELAY = 5E3;
export const START_PUSH_DELAY = 2E3;

const WHITE_LIST = {
  [db.request.type]: true,
  [db.requestGroup.type]: true,
  [db.workspace.type]: true,
  [db.environment.type]: true,
  [db.cookieJar.type]: true
};

export const logger = new Logger();

// TODO: Move this stuff somewhere else
const NO_VERSION = '__NO_VERSION__';
const resourceGroupCache = {};

export async function forceSync () {
  // Make sure sync is on
  await initSync();

  // Force an update
  await _syncPushDirtyResources();
  await _syncPullChanges();
}

let isInitialized = false;
export async function initSync () {
  const settings = await db.settings.getOrCreate();
  if (!settings.optSyncBeta) {
    logger.debug('Not enabled');
    return;
  }

  if (isInitialized) {
    logger.debug('Already enabled');
    return;
  }

  db.onChange(changes => {
    for (const [event, doc] of changes) {
      if (!WHITE_LIST[doc.type]) {
        continue;
      }

      // Make sure it happens async
      process.nextTick(() => _queueChange(event, doc));
    }
  });

  setTimeout(_syncPullChanges, START_PULL_DELAY);
  setTimeout(_syncPushDirtyResources, START_PUSH_DELAY);
  setInterval(_syncPullChanges, FULL_SYNC_INTERVAL);
  isInitialized = true;
  logger.debug('Initialized');
}

// ~~~~~~~ //
// HELPERS //
// ~~~~~~~ //

let commitTimeout = null;

async function _queueChange (event, doc) {
  if (!session.isLoggedIn()) {
    logger.warn('Not logged in');
    return;
  }

  // Update the resource content and set dirty
  const resource = await _getOrCreateResourceForDoc(doc);
  await resourceStore.updateResource(resource, {
    lastEdited: Date.now(), // Don't use doc.modified because that doesn't work for removal
    lastEditedBy: session.getAccountId(),
    content: await _encryptDoc(resource.resourceGroupId, doc),
    removed: event === db.CHANGE_REMOVE,
    dirty: true
  });

  logger.debug(`Queue ${event} ${doc._id}`);

  // Debounce pushing of dirty resources
  clearTimeout(commitTimeout);
  commitTimeout = setTimeout(() => _syncPushDirtyResources(), DEBOUNCE_TIME);
}

async function _syncPushDirtyResources () {
  if (!session.isLoggedIn()) {
    logger.warn('Not logged in');
    return;
  }

  const dirtyResources = await resourceStore.findDirtyResources();

  if (!dirtyResources.length) {
    logger.debug('No changes to push');
    return;
  }

  let responseBody;
  try {
    responseBody = await util.fetchPost('/sync/push', dirtyResources);
  } catch (e) {
    logger.error('Failed to push changes', e);
    return;
  }

  // Update all resource versions with the ones that were returned
  const {updated} = responseBody;
  for (const {id, version} of updated) {
    const resource = await resourceStore.getResourceById(id);
    await resourceStore.updateResource(resource, {version, dirty: false});
    logger.debug(`Updated ${id}`);
  }

  // Update all resource versions with the ones that were returned
  const {created} = responseBody;
  for (const {id, version} of created) {
    const resource = await resourceStore.getResourceById(id);
    await resourceStore.updateResource(resource, {version, dirty: false});
    logger.debug(`Created ${id}`);
  }

  // Update all resource versions with the ones that were returned
  const {removed} = responseBody;
  for (const {id, version} of removed) {
    const resource = await resourceStore.getResourceById(id);
    await resourceStore.updateResource(resource, {version, dirty: false});
    logger.debug(`Removed ${id}`);
  }

  // Resolve conflicts
  const {conflicts} = responseBody;
  for (const serverResource of conflicts) {
    const localResource = await resourceStore.getResourceById(serverResource.id);

    // On conflict, choose last edited one
    const serverIsNewer = serverResource.lastEdited > localResource.lastEdited;
    const winner = serverIsNewer ? serverResource : localResource;

    // Decrypt the docs from the resources. Don't fetch the local doc from the
    // app database, because it might have been deleted.
    logger.debug(`Resolved conflict for ${serverResource.id} (${serverIsNewer ? 'Server' : 'Local'})`, winner);

    // Update local resource
    // NOTE: using localResource as the base to make sure we have _id
    await resourceStore.updateResource(localResource, winner, {
      version: serverResource.version, // Act as the server resource no matter what
      dirty: !serverIsNewer // It's dirty if we chose the local doc
    });

    // Update app database (NOTE: Not silently)
    if (!winner.removed) {
      const doc = await _decryptDoc(winner.resourceGroupId, winner.encContent);
      await db.update(doc);
    }
  }
}

async function _syncPullChanges () {
  if (!session.isLoggedIn()) {
    logger.warn('Not logged in');
    return;
  }

  const allResources = await _getOrCreateAllResources();
  const body = allResources.map(r => ({
    id: r.id,
    resourceGroupId: r.resourceGroupId,
    version: r.version,
    removed: r.removed
  }));

  logger.debug(`Checking ${allResources.length} resources`);

  let responseBody;
  try {
    responseBody = await util.fetchPost('/sync/pull', body);
  } catch (e) {
    logger.error('Failed to sync changes', e, body);
    return;
  }

  const {
    updatedResources,
    createdResources,
    idsToPush,
    idsToRemove
  } = responseBody;

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Insert all the created docs to the DB //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  await createdResources.map(async serverResource => {
    try {
      const {resourceGroupId, encContent} = serverResource;
      const doc = await _decryptDoc(resourceGroupId, encContent);

      // Update local Resource
      await resourceStore.insertResource(serverResource, {dirty: false});

      // Insert into app database (NOTE: not silently)
      await db.insert(doc);
    } catch (e) {
      logger.warn('Failed to decode created resource', e, serverResource);
    }
  });

  if (createdResources.length) {
    logger.debug(`Created ${createdResources.length} resources`, createdResources);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Save all the updated docs to the DB //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  await updatedResources.map(async serverResource => {
    try {
      const {resourceGroupId, encContent} = serverResource;
      const doc = await _decryptDoc(resourceGroupId, encContent);

      // Update app database (NOTE: Not silently)
      await db.update(doc);

      // Update local resource
      const resource = await resourceStore.getResourceById(serverResource.id);
      await resourceStore.updateResource(resource, serverResource, {dirty: false});
    } catch (e) {
      logger.warn('Failed to decode updated resource', e, serverResource);
    }
  });

  if (updatedResources.length) {
    logger.debug(`Updated ${updatedResources.length} resources`, updatedResources);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Remove all the docs that need removing //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  for (const id of idsToRemove) {
    const resource = await resourceStore.getResourceById(id);
    if (!resource) {
      throw new Error(`Could not find Resource to remove for ${id}`)
    }

    const doc = await _decryptDoc(resource.resourceGroupId, resource.encContent);
    if (!doc) {
      throw new Error(`Could not find doc to remove ${id}`)
    }

    // Mark resource as deleted
    await resourceStore.updateResource(resource, {dirty: false, removed: true});

    // Remove from DB (NOTE: Not silently)
    await db.remove(doc);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Push all the docs that need pushing //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  for (const id of idsToPush) {
    const resource = await resourceStore.getResourceById(id);
    if (!resource) {
      throw new Error(`Could not find Resource to push for id ${id}`)
    }

    const doc = await _decryptDoc(resource.resourceGroupId, resource.encContent);
    if (!doc) {
      throw new Error(`Could not find doc to push ${id}`)
    }

    _queueChange(db.CHANGE_UPDATE, doc)
  }
}

/**
 * Fetch a ResourceGroup. If it has been fetched before, lookup from memory
 *
 * @param resourceGroupId
 * @returns {*}
 */
async function _fetchResourceGroup (resourceGroupId) {
  let resourceGroup = resourceGroupCache[resourceGroupId];

  if (!resourceGroup) {
    // TODO: Handle a 404 here
    try {
      resourceGroup = resourceGroupCache[resourceGroupId] = await util.fetchGet(
        `/api/resource_groups/${resourceGroupId}`
      );
    } catch (e) {
      logger.error(`Failed to get ResourceGroup ${resourceGroupId}: ${e}`);
      throw e;
    }
  }

  return resourceGroup;
}

/**
 * Get a ResourceGroup's symmetric encryption key
 *
 * @param resourceGroupId
 * @private
 */
async function _getResourceGroupSymmetricKey (resourceGroupId) {
  const resourceGroup = await _fetchResourceGroup(resourceGroupId);
  const accountPrivateKey = await session.getPrivateKey();

  const symmetricKeyStr = crypt.decryptRSAWithJWK(
    accountPrivateKey,
    resourceGroup.encSymmetricKey
  );

  return JSON.parse(symmetricKeyStr);
}

async function _encryptDoc (resourceGroupId, doc) {
  try {
    const symmetricKey = await _getResourceGroupSymmetricKey(resourceGroupId);
    const docStr = JSON.stringify(doc);
    const message = crypt.encryptAES(symmetricKey, docStr);
    return JSON.stringify(message);
  } catch (e) {
    logger.error(`Failed to encrypt for ${resourceGroupId}: ${e}`);
    throw e;
  }
}

async function _decryptDoc (resourceGroupId, messageJSON) {
  try {
    const symmetricKey = await _getResourceGroupSymmetricKey(resourceGroupId);
    const message = JSON.parse(messageJSON);
    const decrypted = crypt.decryptAES(symmetricKey, message);
    return JSON.parse(decrypted);
  } catch (e) {
    logger.error(`Failed to decrypt from ${resourceGroupId}: ${e}`);
    throw e;
  }
}

async function _getWorkspaceForDoc (doc) {
  const ancestors = await db.withAncestors(doc);
  return ancestors.find(d => d.type === db.workspace.type);
}

async function _createResourceGroup (name = '', description = '') {
  // Generate symmetric key for ResourceGroup
  const rgSymmetricJWK = await crypt.generateAES256Key();
  const rgSymmetricJWKStr = JSON.stringify(rgSymmetricJWK);

  // Encrypt the symmetric key with Account public key
  const publicJWK = session.getPublicKey();
  const encRGSymmetricJWK = crypt.encryptRSAWithJWK(publicJWK, rgSymmetricJWKStr);

  // Create the new ResourceGroup
  let resourceGroup;
  try {
    resourceGroup = await util.fetchPost('/api/resource_groups', {
      name,
      description,
      encSymmetricKey: encRGSymmetricJWK,
    });
  } catch (e) {
    logger.error(`Failed to create ResourceGroup: ${e}`);
    throw e
  }

  logger.debug(`created ResourceGroup ${resourceGroup.id}`);
  return resourceGroup;
}

async function _createResource (doc, resourceGroupId) {
  return resourceStore.insertResource({
    id: doc._id,
    resourceGroupId: resourceGroupId,
    version: NO_VERSION,
    createdBy: session.getAccountId(),
    lastEdited: doc.modified,
    lastEditedBy: session.getAccountId(),
    removed: false,
    type: doc.type,
    encContent: await _encryptDoc(resourceGroupId, doc),
    dirty: true
  });
}

async function _createResourceForDoc (doc) {
  // No resource yet, so create one
  const workspace = await _getWorkspaceForDoc(doc);

  if (!workspace) {
    logger.error('Could not find workspace for doc!', doc);
    return;
  }

  let workspaceResource = await resourceStore.getResourceById(workspace._id);

  if (!workspaceResource) {
    // TODO: Don't auto create a ResourceGroup
    const workspaceResourceGroup = await _createResourceGroup(
      `${workspace.name}`,
      `Workspace ID: ${workspace._id}`
    );
    workspaceResource = await _createResource(workspace, workspaceResourceGroup.id);
  }

  if (workspace === doc) {
    // If the current doc IS a Workspace, just return it
    return workspaceResource;
  } else {
    return await _createResource(doc, workspaceResource.resourceGroupId);
  }
}

async function _getOrCreateResourceForDoc (doc) {
  let resource = await resourceStore.getResourceById(doc._id);

  if (!resource) {
    resource = await _createResourceForDoc(doc);
  }

  return resource;
}

async function _getOrCreateAllResources () {
  const allResourcesMap = {};
  for (const r of await resourceStore.allResources()) {
    allResourcesMap[r.id] = r;
  }

  // TODO: This is REALLY slow (relatively speaking)
  for (const type of Object.keys(WHITE_LIST)) {
    for (const doc of await db.all(type)) {
      const resource = allResourcesMap[doc._id];
      if (!resource) {
        allResourcesMap[doc._id] = await _createResourceForDoc(doc);
      }
    }
  }

  return Object.keys(allResourcesMap).map(k => allResourcesMap[k]);
}
