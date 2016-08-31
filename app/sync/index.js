import request from 'request';
import * as db from '../database';
import {
  TYPE_REQUEST,
  TYPE_REQUEST_GROUP,
  TYPE_WORKSPACE,
  TYPE_STATS,
  TYPE_ENVIRONMENT,
  TYPE_COOKIE_JAR,
  TYPE_RESPONSE,
  TYPE_SETTINGS
} from '../database/index';

const WHITE_LIST = {
  [TYPE_REQUEST]: true,
  [TYPE_REQUEST_GROUP]: true,
  [TYPE_WORKSPACE]: true,
  [TYPE_STATS]: true,
  [TYPE_ENVIRONMENT]: true,
  [TYPE_COOKIE_JAR]: true,
  [TYPE_RESPONSE]: true,
  [TYPE_SETTINGS]: true,
};

const BASE_URL = 'https://oqke109kk9.execute-api.us-east-1.amazonaws.com/dev/v1';

export function initSync () {
  return new Promise(resolve => {

    // ~~~~~~~~~~ //
    // SETUP PUSH //
    // ~~~~~~~~~~ //

    db.onChange('sync', (event, doc) => {

      // Only sync certain models
      if (!WHITE_LIST[doc.type]) {
        return;
      }

      addChange(event, doc);
    });

    // ~~~~~~~~~~ //
    // SETUP PULL //
    // ~~~~~~~~~~ //

    setTimeout(fullSync, 300);
    setInterval(fullSync, 10000);

    resolve();
  });
}


// ~~~~~~~ //
// HELPERS //
// ~~~~~~~ //

function addChange (event, doc) {
  const path = {
    [TYPE_REQUEST]: 'requests',
    [TYPE_WORKSPACE]: 'workspaces',
    [TYPE_REQUEST_GROUP]: 'requestgroups',
    [TYPE_ENVIRONMENT]: 'environments',
    [TYPE_COOKIE_JAR]: 'cookiejars',
    [TYPE_STATS]: 'stats',
    [TYPE_SETTINGS]: 'settings',
    [TYPE_RESPONSE]: 'responses',
  }[doc.type];

  if (!path) {
    return;
  }

  console.log('CRUDDING DOC', doc);

  const config = {
    url: `${BASE_URL}/${path}/${doc._id}`
  };

  if (event === db.EVENT_INSERT || event === db.EVENT_UPDATE) {
    config.method = 'PUT';
    config.json = true;
    config.body = doc;
  } else if (event === db.EVENT_REMOVE) {
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
      console.warn('Failed to push change', response.body.message);
      return;
    }

    if (event !== db.EVENT_REMOVE) {
      const newDoc = response.body.data;
      console.log('UPDATING', newDoc._id);
      db.update(newDoc, true, true);
    }
  });
}

function fullSync () {
  const promises = Object.keys(WHITE_LIST).map(type => db.all(type));
  Promise.all(promises).then(results => {
    const allDocs = [];
    for (const docs of results) {
      for (const doc of docs) {
        allDocs.push(doc);
      }
    }

    const items = allDocs.map(r => [r._id, r._etag]);

    const config = {
      method: 'POST',
      url: `${BASE_URL}/sync`,
      json: true,
      body: items
    };

    request(config, (err, response) => {
      const changes = response.body.data;
      const idsToPush = changes['ids_to_push'];
      const idsToRemove = changes['ids_to_remove'];
      const updatedDocs = changes['updated_docs'];

      // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
      // Save all the updated docs to the DB //
      // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

      console.log('DOCS TO UPDATE', updatedDocs);
      const promises = updatedDocs.map(d => db.update(d, true, true));
      Promise.all(promises).then(() => {
        if (updatedDocs.length) {
          console.log(`Sync Updated ${updatedDocs.length} docs`);
        }
      });

      // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
      // Remove all the docs that need removing //
      // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

      for (const idToRemove of idsToRemove) {
        const doc = allDocs.find(d => d._id === idToRemove);

        if (!doc) {
          throw new Error(`Could not find ID to remove ${idToRemove}`)
        }

        console.log('REMOVING ID', idToRemove);
        db.remove(doc);
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
        addChange(db.EVENT_UPDATE, doc)
      }
    });
  });
}
