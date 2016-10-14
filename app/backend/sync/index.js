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
let activeResourceGroupId = null;
let activeWorkspaceId = null;
const resourceGroupCache = {};

export async function initSync () {

  // ~~~~~~~~~~ //
  // SETUP PUSH //
  // ~~~~~~~~~~ //

  db.onChange(changes => {
    for (const [event, doc] of changes) {
      // Only sync certain models
      if (!WHITE_LIST[doc.type]) {
        return;
      }

      _queueChange(event, doc);
    }
  });

  // ~~~~~~~~~~ //
  // SETUP PULL //
  // ~~~~~~~~~~ //

  setTimeout(_syncPullChanges, 3000);
  setInterval(_syncPullChanges, 1000 * 10);
}

export async function activateWorkspaceId (workspaceId) {
  activeWorkspaceId = workspaceId;
  activeResourceGroupId = null;
  _syncPullChanges();
  console.log(`-- Now syncing workspace ${workspaceId} --`);
}


// ~~~~~~~ //
// HELPERS //
// ~~~~~~~ //

let changesMap = {};
let commitTimeout = null;

function _queueChange (event, doc) {
  changesMap[doc._id] = [event, doc];

  clearTimeout(commitTimeout);
  commitTimeout = setTimeout(() => {
    const changes = Object.keys(changesMap).map(id => changesMap[id]);
    _syncPushChanges(changes);
    changesMap = {};
  }, 3000);
}

async function _syncPushChanges (changes) {
  if (!session.isLoggedIn()) {
    console.warn('-- Trying to sync but not logged in --');
    return;
  }

  if (!activeWorkspaceId) {
    console.log('-- Skipping sync with no active workspace --');
    return;
  }

  await _createMissingLocalResources();

  let body = [];
  for (const change of changes) {
    const [event, doc] = change;
    const resource = await resourceStore.getByResourceId(doc._id);

    if (!resource) {
      console.error(`Failed to find resource by resourceId ${doc._id}`);
      continue;
    }

    if (event === db.CHANGE_INSERT || event === db.CHANGE_UPDATE) {
      body.push({
        resourceId: doc._id,
        resourceETag: resource.resourceETag,
        resourceGroupId: activeResourceGroupId,
        resourceDeleted: false,
        resourceType: doc.type,
        resourceContent: await _encryptDoc(activeResourceGroupId, doc)
      });
    } else if (event === db.CHANGE_REMOVE) {
      body.push({
        resourceId: doc._id,
        resourceETag: resource.resourceETag,
        resourceGroupId: activeResourceGroupId,
        resourceDeleted: true,
        resourceType: doc.type
      });
    }
  }

  console.log('CRUDDING DOCS', body);

  let responseBody;
  try {
    responseBody = await util.fetchPost('/sync/push', body);
  } catch (e) {
    console.error('Failed to push changes', e);
    return;
  }

  const allDocs = [];
  for (const type of Object.keys(WHITE_LIST)) {
    for (const doc of await db.all(type)) {
      allDocs.push(doc);
    }
  }

  const {updated, created} = responseBody;
  for (const {id, etag} of [...created, ...updated]) {
    const resource = await resourceStore.getByResourceId(id);
    await resourceStore.update(Object.assign(resource, {resourceETag: etag}));
  }

  const {conflicts} = responseBody;
  for (const {resourceContent, resourceETag, resourceId, resourceGroupId} of conflicts) {
    console.log('RESOLVING CONFLICT FOR', resourceId);

    // Resolve Conflict
    const serverDoc = await _decryptDoc(resourceGroupId, resourceContent);
    const existingDoc = allDocs.find(d => d._id == resourceId);
    const winner = serverDoc.modified > existingDoc.modified ? serverDoc : existingDoc;

    // Update local databases
    const resource = await resourceStore.getByResourceId(resourceId);
    await resourceStore.update(Object.assign(resource, {resourceETag}));
    await db.update(winner, true)
  }
}

async function _syncPullChanges () {
  if (!session.isLoggedIn()) {
    console.warn('-- Trying to sync but not logged in --');
    return;
  }

  if (!activeWorkspaceId) {
    console.log('-- Skipping sync with no active workspace --');
    return;
  }

  await _createMissingLocalResources();

  const allLocalResources = await resourceStore.findByResourceGroupId(activeResourceGroupId);
  const resourcePairs = allLocalResources.filter(r => !r.resourceDeleted).map(r => ({
    id: r.resourceId,
    etag: r.resourceETag
  }));

  const body = {
    resourceGroupId: activeResourceGroupId,
    resources: resourcePairs
  };

  let responseBody;
  try {
    responseBody = await util.fetchPost('/sync/pull', body);
  } catch (e) {
    console.error('Failed to sync changes', e, body);
    return;
  }

  const {
    updatedResources: updatedDocs,
    createdResources: createdDocs,
    resourceIdsToPush: idsToPush,
    resourceIdsToRemove: idsToRemove
  } = responseBody;

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Insert all the created docs to the DB //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  await createdDocs.map(async serverResource => {
    let doc;

    try {
      doc = await _decryptDoc(serverResource.resourceGroupId, serverResource.resourceContent);
    } catch (e) {
      console.warn('Failed to decrypt resource', e, serverResource.resourceContent);
    }

    console.log('INSERTING', doc);
    await db.insert(doc, true);
    const resource = await resourceStore.getByResourceId(serverResource.resourceId);
    await resourceStore.update(Object.assign(serverResource, {_id: resource._id}));
  });

  if (createdDocs.length) {
    console.log(`Sync created ${createdDocs.length} docs`, createdDocs);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Save all the updated docs to the DB //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  await updatedDocs.map(async serverResource => {
    try {
      const doc = await _decryptDoc(
        serverResource.resourceGroupId,
        serverResource.resourceContent
      );

      await db.update(doc, true);
      const resource = await resourceStore.getByResourceId(serverResource.resourceId);
      await resourceStore.update(Object.assign(serverResource, {_id: resource._id}));
    } catch (e) {
      console.warn('Failed to decode resource', e, serverResource);
    }
  });

  if (updatedDocs.length) {
    console.log(`Sync updated ${updatedDocs.length} docs`, updatedDocs);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Remove all the docs that need removing //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  for (const idToRemove of idsToRemove) {
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
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Push all the docs that need pushing //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  for (const idToPush of idsToPush) {
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

  activeResourceGroupId = resourceGroup.id;
  return resourceGroup;
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
async function _createMissingLocalResources () {
  if (!activeWorkspaceId || !session.isLoggedIn()) {
    console.warn('-- Skipping missing Resource creation --');
    return;
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Create a new ResourceGroup if we haven't already //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  if (!activeResourceGroupId) {
    // See if the Workspace has a Resource already
    const workspace = await db.workspace.getById(activeWorkspaceId);
    const resource = await resourceStore.getByResourceId(workspace._id);

    if (resource) {
      // Use the existing ResourceGroup
      activeResourceGroupId = resource.resourceGroupId;
      console.log(`-- Found existing ResourceGroup ${resource.resourceGroupId} --`)
    } else {
      // Create a ResourceGroup if there isn't one yet
      const resourceGroup = await _createResourceGroup();
      activeResourceGroupId = resourceGroup.id;
    }
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Get all possible documents to sync //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  const allResourcesEver = await resourceStore.findByResourceGroupId(activeResourceGroupId);
  const allResources = allResourcesEver.filter(r => !r.resourceDeleted);
  const workspace = await db.workspace.getById(activeWorkspaceId);
  const allDocsEver = await db.withDescendants(workspace);
  const allDocs = allDocsEver.filter(d => WHITE_LIST[d.type]);
  const resourcesToDelete = allResources.filter(r => !allDocsEver.find(d => d._id === r.resourceId));

  for (const resource of resourcesToDelete) {
    console.log(`-- Removing resource ${resource.resourceId} --`);
    await resourceStore.update(Object.assign(resource, {resourceDeleted: true}));
  }

  for (const doc of allDocs) {
    const resource = allResources.find(r => r.resourceId === doc._id);

    if (resource) {
      // We are already tracking it, so skip
      continue;
    }

    // Start tracking it
    console.log(`-- Tracking new resource ${doc._id} --`);
    await resourceStore.insert({
      resourceId: doc._id,
      resourceETag: NO_ETAG,
      resourceGroupId: activeResourceGroupId,
      resourceDeleted: false,
      resourceType: doc.type,
      resourceContent: await _encryptDoc(activeResourceGroupId, doc)
    });
  }
}
