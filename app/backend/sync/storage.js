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
  return _promisifyCallback(_getDB(), 'find', {});
}

/**
 * Find resources by query
 *
 * @returns {Promise}
 */
export function findResources (query) {
  return _promisifyCallback(_getDB(), 'find', query);
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
export async function getResourceById (id) {
  // TODO: this query should probably include resourceGroupId as well
  const rawDocs = await _promisifyCallback(_getDB(), 'find', {id});
  return rawDocs.length >= 1 ? rawDocs[0] : null;
}

/**
 * Create a new Resource
 *
 * @param resource
 */
export function insertResource (resource) {
  const h = crypto.createHash('md5');
  h.update(resource.resourceGroupId);
  h.update(resource.id);
  const newResource = Object.assign({}, resource, {_id: `rs_${h.digest('hex')}`});
  return _promisifyCallback(_getDB(), 'insert', newResource);
}

/**
 * Update an existing resource
 *
 * @param resource
 * @param patches
 * @returns {Promise}
 */
export function updateResource (resource, ...patches) {
  return _promisifyCallback(
    _getDB(),
    'update',
    {_id: resource._id},
    Object.assign(resource, ...patches)
  );
}

/**
 * Remove an existing resource
 *
 * @param resource
 * @returns {Promise}
 */
export function removeResource (resource) {
  return _promisifyCallback(_getDB(), 'remove', {_id: resource._id});
}

// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //

let _database = null;
function _getDB () {
  if (!_database) {
    // NOTE: Do not EVER change this. EVER!
    const basePath = electron.remote.app.getPath('userData');
    const filePath = fsPath.join(basePath, `sync.Resource.db`);

    // Fill in the defaults
    _database = new NeDB({filename: filePath, autoload: true});

    // Done
    console.log(`-- Initialize Sync DB at ${filePath} --`);
  }

  return _database;
}

function _promisifyCallback (obj, fnName, ...args) {
  return new Promise((resolve, reject) => {
    obj[fnName](...args, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}
