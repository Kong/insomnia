import electron from 'electron';
import NeDB from 'nedb';
import fsPath from 'path';

/**
 * Get all the Resources
 *
 * @returns {Promise}
 */
export function findByResourceGroupId (resourceGroupId) {
  return new Promise((resolve, reject) => {
    _getDB().find({resourceGroupId}, (err, rawDocs) => {
      if (err) {
        reject(err);
      } else {
        resolve(rawDocs);
      }
    })
  });
}

/**
 * Get all Resources
 *
 * @returns {Promise}
 */
export function all () {
  return new Promise((resolve, reject) => {
    _getDB().find({}, (err, rawDocs) => {
      if (err) {
        reject(err);
      } else {
        resolve(rawDocs);
      }
    })
  });
}

/**
 * Get all dirty Resources
 *
 * @returns {Promise}
 */
export function findDirty () {
  return new Promise((resolve, reject) => {
    _getDB().find({dirty: true}, (err, rawDocs) => {
      if (err) {
        reject(err);
      } else {
        resolve(rawDocs);
      }
    })
  });
}

/**
 * Get Resource by resourceID
 *
 * @param resourceId
 * @returns {Promise}
 */
export function getByResourceId (resourceId) {
  return new Promise((resolve, reject) => {
    // TODO: this query should probably include resourceGroupId as well
    _getDB().find({resourceId}, (err, rawDocs) => {
      if (err) {
        reject(err);
      } else {
        resolve(rawDocs.length >= 1 ? rawDocs[0] : null);
      }
    });
  })
}

export function removeResource (resource) {
  return new Promise((resolve, reject) => {
    // TODO: this query should probably include resourceGroupId as well
    _getDB().remove({_id: resource._id}, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  })
}

/**
 * Create a new Resource
 *
 * @param resource
 */
export function insert (resource) {
  return new Promise((resolve, reject) => {
    _getDB().insert(resource, (err, newDoc) => {
      if (err) {
        reject(err);
      } else {
        resolve(newDoc);
      }
    });
  });
}

/**
 * Update an existing resource
 *
 * @param resource
 * @returns {Promise}
 */
export function update (resource) {
  return new Promise((resolve, reject) => {
    _getDB().update({_id: resource._id}, resource, err => {
      if (err) {
        reject(err);
      } else {
        resolve(resource);
      }
    });
  });
}

// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //

let _database = null;
function _getDB () {
  if (!_database) {
    // NOTE: Do not EVER change this. EVER!
    const basePath = electron.remote.app.getPath('userData');
    const filePath = fsPath.join(basePath, `insomnia.sync.resources.db`);

    // Fill in the defaults
    _database = new NeDB({filename: filePath, autoload: true});

    // Done
    console.log(`-- Initialize Sync DB at ${filePath} --`);
  }

  return _database;
}
