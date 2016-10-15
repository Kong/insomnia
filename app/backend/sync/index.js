import * as db from '../database';
import * as util from './util';
import * as crypt from './crypt';
import * as session from './session';
import * as resourceStore from './storage';

const WHITE_LIST = {
  [db.request.type]: true,
  [db.requestGroup.type]: true,
  [db.workspace.type]: true,
  [db.environment.type]: true,
  [db.cookieJar.type]: true
};

// TODO: Move this stuff somewhere else
const NO_ETAG = '__NO_ETAG__';
const resourceGroupCache = {};

export async function initSync () {
  db.onChange(changes => {
    for (const [event, doc] of changes) {
      if (WHITE_LIST[doc.type]) {
        _queueChange(event, doc);
      }
    }
  });

  setTimeout(_syncPullChanges, 1000);
  setInterval(_syncPullChanges, 1000 * 10);
}

// ~~~~~~~ //
// HELPERS //
// ~~~~~~~ //

let commitTimeout = null;

/**
 * Create or update Resource for a given change (also mark as dirty)
 *
 * @param event
 * @param doc
 * @private
 */
async function _queueChange (event, doc) {
  await _createOrUpdateResourceForDoc(doc, event);

  clearTimeout(commitTimeout);
  commitTimeout = setTimeout(() => {
    _syncPushDirtyResources();
  }, 1000);
}

/**
 * Push all local changes that haven't been synced yet
 *
 * @private
 */
async function _syncPushDirtyResources () {
  if (!session.isLoggedIn()) {
    console.warn('-- Trying to sync but not logged in --');
    return;
  }

  // Make sure we have everything
  await _getOrCreateAllResources();
  const dirtyResources = await resourceStore.findDirty();

  const body = dirtyResources.map(r => ({
    resourceId: r.resourceId,
    resourceETag: r.resourceETag,
    resourceGroupId: r.resourceGroupId,
    resourceDeleted: r.resourceDeleted,
    resourceType: r.resourceType,
    resourceContent: r.resourceContent
  }));

  console.log('Dirty Resources', dirtyResources);

  let responseBody;
  try {
    responseBody = await util.fetchPost('/sync/push', body);
  } catch (e) {
    console.error('Failed to push changes', e);
    return;
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Update all resource ETags with the ones that were returned //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  const {updated, created} = responseBody;
  for (const {resourceId, resourceETag} of [...created, ...updated]) {
    const resource = await resourceStore.getByResourceId(resourceId);
    await resourceStore.update(Object.assign(resource, {
      resourceETag,
      dirty: false
    }));
  }

  // ~~~~~~~~~~~~~~~~~ //
  // Resolve conflicts //
  // ~~~~~~~~~~~~~~~~~ //

  const {conflicts} = responseBody;
  for (const conflict of conflicts) {
    const {
      resourceContent,
      resourceETag,
      resourceId,
      resourceGroupId,
      resourceType
    } = conflict;

    console.log('RESOLVING CONFLICT FOR', resourceId);

    // Resolve Conflict
    const serverDoc = await _decryptDoc(resourceGroupId, resourceContent);
    const existingDoc = await db.get(resourceType, resourceId);
    const winner = serverDoc.modified > existingDoc.modified ? serverDoc : existingDoc;

    // Update local databases
    const resource = await resourceStore.getByResourceId(resourceId);
    const updatedResource = Object.assign(resource, {
      resourceETag,
      resourceContent,
      dirty: false
    });
    await resourceStore.update(updatedResource);
    await db.update(winner, true)
  }
}

async function _syncPullChanges () {
  if (!session.isLoggedIn()) {
    console.warn('-- Trying to sync but not logged in --');
    return;
  }

  const body = [];
  for (const resource of await _getOrCreateAllResources()) {
    body.push({
      resourceId: resource.resourceId,
      resourceGroupId: resource.resourceGroupId,
      resourceETag: resource.resourceETag,
      resourceDeleted: resource.resourceDeleted
    })
  }

  let responseBody;
  try {
    responseBody = await util.fetchPost('/sync/pull', body);
  } catch (e) {
    console.error('Failed to sync changes', e, body);
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
    let doc;

    try {
      doc = await _decryptDoc(serverResource.resourceGroupId, serverResource.resourceContent);
    } catch (e) {
      console.warn('Failed to decrypt resource', e, serverResource.resourceContent);
    }

    console.log('INSERTING', doc);
    await db.insert(doc, true);
    const resource = await resourceStore.getByResourceId(serverResource.resourceId);
    await resourceStore.update(Object.assign(serverResource, {
      _id: resource._id,
      dirty: false
    }));
  });

  if (createdResources.length) {
    console.log(`Sync created ${createdResources.length} docs`, createdResources);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Save all the updated docs to the DB //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  await updatedResources.map(async serverResource => {
    try {
      const doc = await _decryptDoc(
        serverResource.resourceGroupId,
        serverResource.resourceContent
      );

      await db.update(doc, true);
      const resource = await resourceStore.getByResourceId(serverResource.resourceId);
      await resourceStore.update(Object.assign(serverResource, {
        _id: resource._id,
        dirty: false
      }));
    } catch (e) {
      console.warn('Failed to decode resource', e, serverResource);
    }
  });

  if (updatedResources.length) {
    console.log(`Sync updated ${updatedResources.length} docs`, updatedResources);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Remove all the docs that need removing //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  for (const idToRemove of resourceIdsToRemove) {
    const resource = await resourceStore.getByResourceId(idToRemove);
    if (!resource) {
      throw new Error(`Could not find Resource to remove for resourceId ${idToRemove}`)
    }

    const doc = await db.getWhere(
      resource.resourceType,
      {_id: resource.resourceId}
    );
    if (!doc) {
      throw new Error(`Could not find doc to remove ${idToRemove}`)
    }

    console.log('REMOVING ID', idToRemove);
    await db.remove(doc, true);
    await resourceStore.update(Object.assign(resource, {
      dirty: false,
      resourceDeleted: true
    }));
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Push all the docs that need pushing //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  for (const idToPush of resourceIdsToPush) {
    const resource = await resourceStore.getByResourceId(idToPush);
    if (!resource) {
      throw new Error(`Could not find Resource to push for resourceId ${idToPush}`)
    }

    const doc = await db.getWhere(resource.resourceType, {_id: resource.resourceId});
    if (!doc) {
      throw new Error(`Could not find doc to push ${idToPush}`)
    }

    console.log('NEED TO PUSH', idToPush);
    _queueChange(db.CHANGE_UPDATE, doc)
  }
}

/**
 * Fetch a ResourceGroup. If it has been fetched before, lookup from memory
 *
 * @param resourceGroupId
 * @returns {*}
 * @private
 */
async function _fetchResourceGroup (resourceGroupId) {
  if (!resourceGroupCache.hasOwnProperty(resourceGroupId)) {
    resourceGroupCache[resourceGroupId] = await util.fetchGet(
      `/resource_groups/${resourceGroupId}`
    );
  }
  return resourceGroupCache[resourceGroupId];
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

/**
 * Encrypt a database doc
 *
 * @param resourceGroupId
 * @param doc
 * @private
 */
async function _encryptDoc (resourceGroupId, doc) {
  const symmetricKey = await _getResourceGroupSymmetricKey(resourceGroupId);
  const docStr = JSON.stringify(doc);
  const message = crypt.encryptAES(symmetricKey, docStr);
  return JSON.stringify(message);
}

/**
 * Decrypt a database doc
 * @param resourceGroupId
 * @param messageJSON
 * @private
 */
async function _decryptDoc (resourceGroupId, messageJSON) {
  const symmetricKey = await _getResourceGroupSymmetricKey(resourceGroupId);
  const message = JSON.parse(messageJSON);
  const decrypted = crypt.decryptAES(symmetricKey, message);
  return JSON.parse(decrypted);
}

/**
 * Checks all docs that should be synced, and tracks ones that aren't yet.
 *
 * @private
 */
async function _getOrCreateAllResources () {
  if (!session.isLoggedIn()) {
    console.warn('-- Not logged in for resource creation --');
    return;
  }

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

async function _getWorkspaceForDoc (doc) {
  const ancestors = await db.withAncestors(doc);
  return ancestors.find(d => d.type === db.workspace.type);
}

async function _createResourceGroup () {
  // Generate symmetric key for ResourceGroup
  const rgSymmetricJWK = await crypt.generateAES256Key();
  const rgSymmetricJWKStr = JSON.stringify(rgSymmetricJWK);

  // Encrypt the symmetric key with Account public key
  const publicJWK = session.getPublicKey();
  const encRGSymmetricJWK = crypt.encryptRSAWithJWK(publicJWK, rgSymmetricJWKStr);

  // Create the new ResourceGroup
  const resourceGroup = await util.fetchPost('/resource_groups', {
    encSymmetricKey: encRGSymmetricJWK,
    name: 'Test Group',
    description: ''
  });

  console.log(`-- Created new ResourceGroup ${resourceGroup.id} --`);

  return resourceGroup;
}

async function _createResource (doc, resourceGroupId) {
  return resourceStore.insert({
    resourceId: doc._id,
    resourceETag: NO_ETAG,
    resourceGroupId: resourceGroupId,
    resourceDeleted: false,
    resourceType: doc.type,
    resourceContent: await _encryptDoc(resourceGroupId, doc),
    dirty: true
  });
}

/**
 * Creates a resource if it doesn't have one. Might also create a ResourceGroup
 * if it's ancestor Workspace doesn't have one yet.
 *
 * @param doc
 * @param event
 * @returns {Promise}
 * @private
 */
async function _createOrUpdateResourceForDoc (doc, event) {
  const resource = await _getOrCreateResourceForDoc(doc);

  // Update the resource content and dirty state
  const finalResource = Object.assign(resource, {
    resourceContent: await _encryptDoc(resource.resourceGroupId, doc),
    resourceDeleted: event === db.CHANGE_REMOVE,
    dirty: true
  });

  console.log(`-- Updated resource ${resource.resourceId} --`);
  return resourceStore.update(finalResource);
}

async function _getOrCreateResourceForDoc (doc) {
  let resource = await resourceStore.getByResourceId(doc._id);

  if (!resource) {
    // No resource yet, so create one
    const workspace = await _getWorkspaceForDoc(doc);
    let workspaceResource = await resourceStore.getByResourceId(workspace._id);

    console.log(`-- Created resource for ${doc._id}`);

    if (!workspaceResource) {
      // TODO: Don't auto create a ResourceGroup
      const workspaceResourceGroup = await _createResourceGroup();
      workspaceResource = await _createResource(workspace, workspaceResourceGroup.id);
      console.log(`-- Created resource for ${workspace._id}`);
    }

    resource = await _createResource(doc, workspaceResource.resourceGroupId);
  }

  return resource;
}

async function allResources () {
  const all = await resourceStore.all();
  console.log(all);
}
window.allResources = allResources;
