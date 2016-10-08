import request from 'request';
import * as db  from '../database';

const WHITE_LIST = {
  [db.request.type]: true,
  [db.requestGroup.type]: true,
  [db.workspace.type]: true,
  [db.environment.type]: true,
  [db.cookieJar.type]: true
};

const BASE_URL = 'http://localhost:8000/api/v1/sync';
const SESSION_ID = '40b83372e7663f9ed5f6949b4cbb1197bb57921da32d00d1101db8a3137aa08b';
const RESOURCE_GROUP_ID = 'rsgr_5dfba4be2e4a4bcfa29997b8e070ecd2';

export function initSync () {

  // ~~~~~~~~~~ //
  // SETUP PUSH //
  // ~~~~~~~~~~ //

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

  setTimeout(fullSync, 300);
  setInterval(fullSync, 10000);
}


// ~~~~~~~ //
// HELPERS //
// ~~~~~~~ //

let changes = {};
let commitTimeout = null;
function addChange (event, doc) {
  changes[doc._id] = [event, doc];

  clearTimeout(commitTimeout);
  commitTimeout = setTimeout(() => {
    for (const key of Object.keys(changes)) {
      const change = changes[key];
      commitChange(change[0], change[1]);
    }

    changes = {};
  }, 3000);
}

function commitChange (event, doc) {
  console.log('CRUDDING DOC', doc._id);

  const config = {
    url: `${BASE_URL}/push`,
    headers: {
      'X-Session-ID': SESSION_ID
    }
  };

  if (event === db.CHANGE_INSERT || event === db.CHANGE_UPDATE) {
    config.method = 'POST';
    config.json = true;
    config.body = [{
      resourceId: doc._id,
      resourceETag: doc._etag,
      resourceGroupId: RESOURCE_GROUP_ID,
      resourceDeleted: false,
      resourceType: doc.type,
      resourceContent: JSON.stringify(doc, null, 2)
    }];
  } else if (event === db.CHANGE_REMOVE) {
    config.method = 'POST';
    config.json = true;
    config.body = [{
      resourceId: doc._id,
      resourceETag: doc._etag,
      resourceGroupId: RESOURCE_GROUP_ID,
      resourceDeleted: true,
      resourceType: doc.type
    }];
  }

  request(config, async (err, response) => {
    if (err) {
      console.error('Failed to push changes', err);
      return;
    }

    if (response.statusCode !== 200) {
      console.warn('Failed to add change', response.statusCode, response.body);
      return;
    }

    if (event !== db.CHANGE_REMOVE) {
      const allDocs = [];
      for (const type of Object.keys(WHITE_LIST)) {
        for (const doc of await db.all(type)) {
          allDocs.push(doc);
        }
      }
      // TODO: Replace all local ETAGs with ones returned in response
      const {conflicts, updated, created, removed} = response.body;

      for (const item of [...created, ...updated]) {
        const existingDoc = allDocs.find(d => d._id == item.id);
        await db.update(Object.assign(existingDoc, {
          _etag: item.etag
        }), true)
      }

      for (const resource of conflicts) {
        const existingDoc = JSON.parse(resource.resourceContent);
        console.log('RESOLVING CONFLICT FOR', resource, existingDoc);
        await db.update(Object.assign(existingDoc, {
          _etag: resource.resourceETag
        }), true)
      }
    }
  });
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

  const config = {
    method: 'POST',
    url: `${BASE_URL}/pull`,
    json: true,
    headers: {
      'X-Session-ID': SESSION_ID
    },
    body: {
      resourceGroupId: RESOURCE_GROUP_ID,
      resources: allResources
    }
  };

  request(config, async (err, response) => {
    if (err) {
      console.error('Failed to sync changes', err, config);
      return;
    }

    if (response.statusCode !== 200) {
      console.warn(
        'Failed to sync changes',
        response.statusCode,
        response.body,
        config
      );
      return;
    }

    const {
      updatedResources: updatedDocs,
      createdResources: createdDocs,
      resourceIdsToPush: idsToPush,
      resourceIdsToRemove: idsToRemove
    } = response.body;

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
        console.warn('Failed to decode resource', e, resource.resourceContent);
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

      console.log('PUSHING ID', idToPush);
      addChange(db.CHANGE_UPDATE, doc)
    }
  });
}
