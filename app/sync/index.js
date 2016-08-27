import request from 'request';

import * as db from '../database';

import {
  TYPE_REQUEST,
  TYPE_REQUEST_GROUP,
  TYPE_WORKSPACE,
  TYPE_STATS,
  TYPE_ENVIRONMENT,
  TYPE_COOKIE_JAR
} from '../database/index';

const WHITE_LIST = {
  [TYPE_REQUEST]: true,
  [TYPE_REQUEST_GROUP]: true,
  [TYPE_WORKSPACE]: true,
  [TYPE_STATS]: true,
  [TYPE_ENVIRONMENT]: true,
  [TYPE_COOKIE_JAR]: true,
};

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

    setInterval(fetchChanges, 2000);

    resolve();
  });
}


// ~~~~~~~ //
// HELPERS //
// ~~~~~~~ //

function addChange (event, doc) {
  const path = {
    Request: 'requests',
    Workspace: 'workspaces',
    RequestGroup: 'requestgroups',
    Environment: 'environments',
    CookieJar: 'cookiejars',
    Stats: 'stats',
  }[doc.type];

  const config = {
    // url: `http://localhost:5001/api/v1/${path}/${doc._id}`
    url: `https://insomnia-api.herokuapp.com/api/v1/${path}/${doc._id}`
  };

  if (event === 'insert' || event === 'update') {
    config.method = 'PUT';
    config.json = true;
    config.body = doc;
  } else if (event === 'remove') {
    config.method = 'DELETE';
  }

  request(config, (err, response) => {
    if (err) {
      console.error('Failed to push changes', err);
      return;
    }

    db.update(doc, true, true);
    console.log('--------');
    console.log('ORIGINAL', doc);
    console.log('NEXT    ', response.body);
    console.log('--------');
  });
}

let lastCheck = 0;
function fetchChanges () {
  const config = {
    method: 'GET',
    url: `https://insomnia-api.herokuapp.com/api/v1/changes`,
    // url: 'http://localhost:5001/api/v1/changes',
    qs: {gte: lastCheck},
    json: true
  };

  request(config, (err, response) => {
    const changes = response.body.data;

    for (const change of changes) {
      if (change.doc === null) {
        db.removeById(change.doc_id)
      } else {
        db.update(change.doc, false, true)
      }
    }

    console.log(response.body)
  });

  lastCheck = Date.now();
}
