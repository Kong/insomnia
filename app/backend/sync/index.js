import * as db from '../database';
import * as util from './util';
import * as crypt from './crypt';
import * as session from './session';
import * as resourceStore from './storage';

const FULL_SYNC_INTERVAL = 30E3;
const DEBOUNCE_TIME = 9E3;
const START_DELAY = 3E3;

const WHITE_LIST = {
  [db.request.type]: true,
  [db.requestGroup.type]: true,
  [db.workspace.type]: true,
  [db.environment.type]: true,
  [db.cookieJar.type]: true
};

class Logger {
  constructor () {
    this._logs = [];
  }

  debug (message, ...args) {
    this._log('debug', message, ...args);
  }

  warn (message, ...args) {
    this._log('warn', message, ...args);
  }

  error (message, ...args) {
    this._log('error', message, ...args);
  }

  tail () {
    return this._logs;
  }

  /** @private */
  _log (type, message, ...args) {
    let fn;
    if (type === 'debug') {
      fn = 'log';
    } else if (type === 'warn') {
      fn = 'warn';
    } else {
      fn = 'error';
    }

    console[fn](`-- Sync ${message} --`, ...args);
    const timestamp = Date.now();
    this._logs.push({type, timestamp, message});
  }
}

export const logger = new Logger();

// TODO: Move this stuff somewhere else
const NO_VERSION = '__NO_VERSION__';
const resourceGroupCache = {};

export async function initSync () {
  db.onChange(changes => {
    changes
      .filter(c => WHITE_LIST.hasOwnProperty(c[1].type))
      .map(c => _queueChange(c[0], c[1]));
  });

  setTimeout(_syncPullChanges, START_DELAY);
  setTimeout(_syncPushDirtyResources, START_DELAY);
  setInterval(_syncPullChanges, FULL_SYNC_INTERVAL);
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
  await resourceStore.update(resource, {
    content: await _encryptDoc(resource.resourceGroupId, doc),
    removed: event === db.CHANGE_REMOVE,
    dirty: true
  });

  logger.debug(`Marked ${doc._id} dirty`);

  // Debounce pushing of dirty resources
  clearTimeout(commitTimeout);
  commitTimeout = setTimeout(() => _syncPushDirtyResources(), DEBOUNCE_TIME);
}

async function _syncPushDirtyResources () {
  if (!session.isLoggedIn()) {
    logger.warn('Not logged in');
    return;
  }

  const dirtyResources = await resourceStore.findDirty();

  if (!dirtyResources.length) {
    logger.debug('No changes to push');
    return;
  }

  const body = dirtyResources.map(r => ({
    resourceId: r.resourceId,
    resourceGroupId: r.resourceGroupId,
    version: r.version,
    removed: r.removed,
    type: r.type,
    encContent: r.encContent
  }));

  let responseBody;
  try {
    responseBody = await util.fetchPost('/sync/push', body);
  } catch (e) {
    logger.error('Failed to push changes', e);
    return;
  }

  // Update all resource versions with the ones that were returned
  const {updated} = responseBody;
  for (const {resourceId, version} of updated) {
    const resource = await resourceStore.getByResourceId(resourceId);
    await resourceStore.update(resource, {version, dirty: false});
    logger.debug(`Updated from ${resourceId}`);
  }

  // Update all resource versions with the ones that were returned
  const {created} = responseBody;
  for (const {resourceId, version} of created) {
    const resource = await resourceStore.getByResourceId(resourceId);
    await resourceStore.update(resource, {version, dirty: false});
    logger.debug(`Created from ${resourceId}`);
  }

  // Resolve conflicts
  const {conflicts} = responseBody;
  for (const serverResource of conflicts) {
    const localResource = await resourceStore.getByResourceId(serverResource.resourceId);

    // Decrypt the docs from the resources. Don't fetch the local doc from the
    // app database, because it might have been deleted.
    const serverDoc = await _decryptDoc(serverResource.resourceGroupId, serverResource.encContent);
    const localDoc = await _decryptDoc(serverResource.resourceGroupId, localResource.encContent);

    // On conflict, choose last modified one
    const serverIsNewer = serverDoc.modified >= localDoc.modified;
    const winningDoc = serverIsNewer ? serverDoc : localDoc;

    logger.debug(`Resolved conflict for ${serverDoc._id} (${serverIsNewer ? 'Server' : 'Local'})`);

    // Update local resource
    await resourceStore.update(localResource, {
      version: serverResource.version,
      encContent: serverIsNewer ? serverResource.encContent : localResource.encContent,
      dirty: !serverIsNewer // It's dirty if we chose the local doc
    });

    // Update app database (NOTE: Not silently)
    await db.update(winningDoc);
  }
}

async function _syncPullChanges () {
  if (!session.isLoggedIn()) {
    logger.warn('Not logged in');
    return;
  }

  const allResources = await _getOrCreateAllResources();
  const body = allResources.map(r => ({
    resourceId: r.resourceId,
    resourceGroupId: r.resourceGroupId,
    version: r.version,
    remove: r.removed
  }));

  logger.debug(`Doing full sync with ${allResources.length} resources`);

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
    resourceIdsToPush,
    resourceIdsToRemove
  } = responseBody;

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Insert all the created docs to the DB //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  await createdResources.map(async serverResource => {
    try {
      const {resourceGroupId, encContent} = serverResource;
      const doc = await _decryptDoc(resourceGroupId, encContent);

      // Update local Resource
      await resourceStore.insert(serverResource, {dirty: false});

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
      const resource = await resourceStore.getByResourceId(serverResource.resourceId);
      await resourceStore.update(resource, serverResource, {dirty: false});
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

  for (const idToRemove of resourceIdsToRemove) {
    const resource = await resourceStore.getByResourceId(idToRemove);
    if (!resource) {
      throw new Error(`Could not find Resource to remove for ${idToRemove}`)
    }

    const doc = await _decryptDoc(resource.resourceGroupId, resource.encContent);
    if (!doc) {
      throw new Error(`Could not find doc to remove ${idToRemove}`)
    }

    // Mark resource as deleted
    await resourceStore.update(resource, {dirty: false, removed: true});

    // Remove from DB (NOTE: Not silently)
    await db.remove(doc);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Push all the docs that need pushing //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  for (const idToPush of resourceIdsToPush) {
    const resource = await resourceStore.getByResourceId(idToPush);
    if (!resource) {
      throw new Error(`Could not find Resource to push for resourceId ${idToPush}`)
    }

    const doc = await _decryptDoc(resource.resourceGroupId, resource.encContent);
    if (!doc) {
      throw new Error(`Could not find doc to push ${idToPush}`)
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
    resourceGroup = resourceGroupCache[resourceGroupId] = await util.fetchGet(
      `/api/resource_groups/${resourceGroupId}`
    );
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
  const accountPrivateKey = await session.getAccountPrivateKey();

  const symmetricKeyStr = crypt.decryptRSAWithJWK(
    accountPrivateKey,
    resourceGroup.encSymmetricKey
  );

  return JSON.parse(symmetricKeyStr);
}

async function _encryptDoc (resourceGroupId, doc) {
  const symmetricKey = await _getResourceGroupSymmetricKey(resourceGroupId);
  const docStr = JSON.stringify(doc);
  const message = crypt.encryptAES(symmetricKey, docStr);
  return JSON.stringify(message);
}

async function _decryptDoc (resourceGroupId, messageJSON) {
  const symmetricKey = await _getResourceGroupSymmetricKey(resourceGroupId);
  const message = JSON.parse(messageJSON);
  const decrypted = crypt.decryptAES(symmetricKey, message);
  return JSON.parse(decrypted);
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
  const resourceGroup = await util.fetchPost('/api/resource_groups', {
    name,
    description,
    encSymmetricKey: encRGSymmetricJWK,
  });

  logger.debug(`Created ResourceGroup ${resourceGroup.id}`);

  return resourceGroup;
}

async function _createResource (doc, resourceGroupId) {
  return resourceStore.insert({
    resourceId: doc._id,
    resourceGroupId: resourceGroupId,
    version: NO_VERSION,
    removed: false,
    type: doc.type,
    encContent: await _encryptDoc(resourceGroupId, doc),
    dirty: true
  });
}

async function _getOrCreateResourceForDoc (doc) {
  let resource = await resourceStore.getByResourceId(doc._id);

  if (!resource) {
    // No resource yet, so create one
    const workspace = await _getWorkspaceForDoc(doc);

    if (!workspace) {
      logger.error('Could not find workspace for doc!', doc, resource);
      return;
    }

    let workspaceResource = await resourceStore.getByResourceId(workspace._id);

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
      resource = workspaceResource;
    } else {
      resource = await _createResource(doc, workspaceResource.resourceGroupId);
    }
  }

  return resource;
}

async function _getOrCreateAllResources () {
  const allResources = [];

  // TODO: This is REALLY slow (relatively speaking)
  for (const type of Object.keys(WHITE_LIST)) {
    for (const doc of await db.all(type)) {
      const resource = await _getOrCreateResourceForDoc(doc);
      allResources.push(resource);
    }
  }

  return allResources;
}
