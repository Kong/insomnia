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

/**
 * Get a Resource by Id
 *
 * @param id
 * @returns {Promise}
 */
export function getById (id) {
  return new Promise((resolve, reject) => {
    _getDB().find({_id: id}, (err, rawDocs) => {
      if (err) {
        reject(err);
      } else {
        resolve(rawDocs.length >= 1 ? rawDocs[0] : null);
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
 * @param patch
 * @param patch2
 * @returns {Promise}
 */
export function update (resource, patch = {}, patch2 = {}) {
  return new Promise((resolve, reject) => {
    const updatedResource = Object.assign(resource, patch, patch2);
    _getDB().update({_id: resource._id}, updatedResource, err => {
      if (err) {
        reject(err);
      } else {
        resolve(resource);
      }
    });
  });
}

/**
 * Remove an existing resource
 *
 * @param resource
 * @returns {Promise}
 */
export function remove (resource) {
  return new Promise((resolve, reject) => {
    _getDB().remove({_id: resource._id}, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
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
