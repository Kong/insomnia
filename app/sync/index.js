import * as db from '../database';
import request from 'request';
import {buildChange} from './util';
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
      if (!WHITE_LIST[doc.type]) {
        return;
      }

      // Add the change to the queue
      const change = buildChange(event, doc);
      sendChange(change);
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

let seenChangeIds = {};
let changeTimeout = null;
let changes = [];

function sendChange (change) {
  changes.push(change);

  clearTimeout(changeTimeout);
  changeTimeout = setTimeout(() => {
    sendChanges(changes);
    changes = [];
  }, 2000);
}

function sendChanges (changes) {
  request({
    method: 'POST',
    url: 'http://localhost:5001/api/v1/changes',
    body: JSON.stringify(changes),
    headers: {
      'content-type': 'application/json'
    }
  }, (err, response) => {
    if (err) {
      console.error('Failed to push changes', err);
      return;
    }

    const {data: changes} = JSON.parse(response.body);
    for (const change of changes) {
      blacklistChange(change);
    }

    console.log(`Sent ${changes.length} changes`);
  });
}

let lastSyncTimestamp = 0;

/**
 * Get latest changes from server
 */
function fetchChanges () {
  request({
    method: 'GET',
    url: 'http://localhost:5001/api/v1/changes',
    qs: {
      gte: lastSyncTimestamp
    }
  }, (err, response) => {
    if (err) {
      console.error('Failed to get changes', err);
      return;
    }

    const {data: changes} = JSON.parse(response.body);
    changes.map(handleChange);
  });

  lastSyncTimestamp = Date.now();
}

function handleChange (change) {
  if (isChangeBlacklisted(change)) {
    console.log('Skipping blacklisted change');
    return;
  }

  db.update(change.doc);
  console.log('Got change!!!!!!!!!!', change);
  blacklistChange(change);
}

const seenChanges = {};
function blacklistChange (change) {
  seenChanges[change._id] = 1;
}

function isChangeBlacklisted (change) {
  return !!seenChanges[change._id];
}
