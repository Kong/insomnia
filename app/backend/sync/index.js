import request from 'request';
import * as db  from '../database';

const WHITE_LIST = {
  [db.request.type]: true,
  [db.requestGroup.type]: true,
  [db.workspace.type]: true,
  [db.environment.type]: true,
  [db.cookieJar.type]: true
};

const BASE_URL = 'https://o90qg2me5g.execute-api.us-east-1.amazonaws.com/dev/v1';

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
  const path = {
    [db.request.type]: 'requests',
    [db.workspace.type]: 'workspaces',
    [db.requestGroup.type]: 'requestgroups',
    [db.environment.type]: 'environments',
    [db.cookieJar.type]: 'cookiejars'
  }[doc.type];

  if (!path) {
    return;
  }

  console.log('CRUDDING DOC', doc._id);

  const config = {
    url: `${BASE_URL}/${path}/${doc._id}`
  };

  if (event === db.CHANGE_INSERT || event === db.CHANGE_UPDATE) {
    config.method = 'PUT';
    config.json = true;
    config.body = doc;
  } else if (event === db.CHANGE_REMOVE) {
    config.method = 'DELETE';
  }

  request(config, (err, response) => {
    if (err) {
      console.error('Failed to push changes', err);
      return;
    }

    if (response.statusCode !== 200) {
      console.warn('Failed to add change', response.statusCode, response.body);
      return;
    }

    if (!response.body.success) {
      console.warn('Failed to push change', response.body);
      return;
    }

    if (event !== db.CHANGE_REMOVE) {
      const newDoc = response.body.data;
      db.update(newDoc, true);
    }
  });
}

async function fullSync () {
  const allDocs = [];
  for (const type of Object.keys(WHITE_LIST)) {
    for (const doc of await db.all(type)) {
      allDocs.push(doc)
    }
  }

  const items = allDocs.map(r => [r._id, r._etag]);

  const config = {
    method: 'POST',
    url: `${BASE_URL}/sync`,
    json: true,
    body: items
  };

  request(config, async (err, response) => {
    if (err) {
      console.error('Failed to sync changes', err);
      return;
    }

    if (response.statusCode !== 200) {
      console.warn('Failed to sync changes', response.body);
      return;
    }

    if (!response.body.success) {
      console.warn('Failed to sync changes', response.body);
      return;
    }

    const changes = response.body.data;
    const {
      ids_to_push: idsToPush,
      ids_to_remove: idsToRemove,
      updated_docs: updatedDocs,
      created_docs: createdDocs
    } = changes;

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
    // Insert all the created docs to the DB //
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

    await createdDocs.map(d => db.insert(d, true));
    if (createdDocs.length) {
      console.log(`Sync created ${createdDocs.length} docs`, createdDocs);
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
    // Save all the updated docs to the DB //
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

    await updatedDocs.map(d => db.update(d, true));
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
