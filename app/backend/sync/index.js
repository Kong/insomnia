import * as db  from '../database';
import * as session from './session';
import * as util from './util';

const WHITE_LIST = {
  [db.request.type]: true,
  [db.requestGroup.type]: true,
  [db.workspace.type]: true,
  [db.environment.type]: true,
  [db.cookieJar.type]: true
};

let resourceGroupId = 'rsgr_a2a37a72b58b4cb5acb0d64057462dc0';

function _createResourceGroup () {
  return util.fetchPost('/resource_groups', {
    encSymmetricKey: 'n/a',
    name: 'My Resource Group',
    description: 'No Description'
  });
}

export async function initSync () {

  // ~~~~~~~~~~ //
  // SETUP PUSH //
  // ~~~~~~~~~~ //

  // await session.login('greg@schier.co', 'test');
  // const resourceGroup = _createResourceGroup();

  db.onChange(changes => {
    for (const [event, doc] of changes) {
      // Only sync certain models
      if (!WHITE_LIST[doc.type]) {
        return;
      }

      addChange(event, doc);
    }
  });

  // ~~~~~~~~~~ //
  // SETUP PULL //
  // ~~~~~~~~~~ //

  setTimeout(fullSync, 1000);
  setInterval(fullSync, 1000 * 30);
}


// ~~~~~~~ //
// HELPERS //
// ~~~~~~~ //

let changesMap = {};
let commitTimeout = null;
function addChange (event, doc) {
  changesMap[doc._id] = [event, doc];

  clearTimeout(commitTimeout);
  commitTimeout = setTimeout(() => {
    const changes = Object.keys(changesMap).map(id => changesMap[id]);
    commitChanges(changes);
    changesMap = {};
  }, 5000);
}

async function commitChanges (changes) {

  let body = [];
  for (const change of changes) {
    const [event, doc] = change;

    if (event === db.CHANGE_INSERT || event === db.CHANGE_UPDATE) {
      body.push({
        resourceId: doc._id,
        resourceETag: doc._etag,
        resourceGroupId: resourceGroupId,
        resourceDeleted: false,
        resourceType: doc.type,
        resourceContent: JSON.stringify(doc, null, 2)
      });
    } else if (event === db.CHANGE_REMOVE) {
      body.push({
        resourceId: doc._id,
        resourceETag: doc._etag,
        resourceGroupId: resourceGroupId,
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
  // TODO: Replace all local ETAGs with ones returned in response
  const {updated, created} = responseBody;
  for (const {id, etag} of [...created, ...updated]) {
    const existingDoc = allDocs.find(d => d._id == id);
    await db.update(Object.assign(existingDoc, {_etag: etag}), true)
  }

  const {conflicts} = responseBody;
  for (const {resourceContent, resourceETag, resourceId} of conflicts) {
    const serverDoc = JSON.parse(resourceContent);
    const existingDoc = allDocs.find(d => d._id == resourceId);
    console.log('RESOLVING CONFLICT FOR', serverDoc);
    const winner = serverDoc.modified > existingDoc.modified ? serverDoc : existingDoc;
    await db.update(Object.assign(winner, {_etag: resourceETag}), true)
  }
}

async function fullSync () {
  const allDocs = [];
  const allResources = [];

  for (const type of Object.keys(WHITE_LIST)) {
    for (const doc of await db.all(type)) {
      allDocs.push(doc);
      allResources.push({id: doc._id, etag: doc._etag});
    }
  }

  const body = {resourceGroupId, resources: allResources};

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

  await createdDocs.map(resource => {
    let oldDoc;
    try {
      oldDoc = JSON.parse(resource.resourceContent);
    } catch (e) {
      console.warn('Failed to decode resource', e, resource.resourceContent);
      return;
    }

    const doc = Object.assign(oldDoc, {
      _etag: resource.resourceETag,
    });

    return db.insert(doc, true);
  });
  if (createdDocs.length) {
    console.log(`Sync created ${createdDocs.length} docs`, createdDocs);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Save all the updated docs to the DB //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  await updatedDocs.map(resource => {
    let oldDoc;
    try {
      oldDoc = JSON.parse(resource.resourceContent);
    } catch (e) {
      console.warn('Failed to decode resource', e, resource);
      return;
    }
    const doc = Object.assign(oldDoc, {
      _etag: resource.resourceETag,
    });

    return db.update(doc, true);
  });
  if (updatedDocs.length) {
    console.log(`Sync updated ${updatedDocs.length} docs`, updatedDocs);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Remove all the docs that need removing //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  for (const idToRemove of idsToRemove) {
    const doc = allDocs.find(d => d._id === idToRemove);

    if (!doc) {
      throw new Error(`Could not find ID to remove ${idToRemove}`)
    }

    console.log('REMOVING ID', idToRemove);
    await db.remove(doc, true);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Push all the docs that need pushing //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  for (const idToPush of idsToPush) {
    const doc = allDocs.find(d => d._id === idToPush);

    if (!doc) {
      throw new Error(`Could not find ID to push ${idToPush}`)
    }

    console.log('NEED TO PUSH', idToPush);
    addChange(db.CHANGE_UPDATE, doc)
  }
}
