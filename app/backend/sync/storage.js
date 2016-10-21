import electron from 'electron';
import NeDB from 'nedb';
import fsPath from 'path';
import crypto from 'crypto';

/**
 * Get all Resources
 *
 * @returns {Promise}
 */
export function allResources () {
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
 * Find resources by query
 *
 * @returns {Promise}
 */
export function findResources (query) {
  return new Promise((resolve, reject) => {
    _getDB().find(query, (err, rawDocs) => {
      if (err) {
        reject(err);
      } else {
        resolve(rawDocs);
      }
    })
  });
}

/**
 * Get all dirty resources
 * @returns {Promise}
 */
export function findDirtyResources () {
  return findResources({dirty: true});
}

/**
 * Get Resource by resourceID
 *
 * @param id
 * @returns {Promise}
 */
export function getResourceById (id) {
  return new Promise((resolve, reject) => {
    // TODO: this query should probably include resourceGroupId as well
    _getDB().find({id}, (err, rawDocs) => {
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
export function insertResource (resource) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('md5');
    h.update(resource.resourceGroupId);
    h.update(resource.id);
    resource._id = `rs_${h.digest('hex')}`;
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
 * @param patches
 * @returns {Promise}
 */
export function updateResource (resource, ...patches) {
  return new Promise((resolve, reject) => {
    const updatedResource = Object.assign(resource, ...patches);
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
export function removeResource (resource) {
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
