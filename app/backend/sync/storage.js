import electron from 'electron';
import NeDB from 'nedb';
import fsPath from 'path';
import crypto from 'crypto';

const TYPE_RESOURCE = 'Resource';
const TYPE_RESOURCE_GROUP_CONFIG = 'ResourceGroupConfig';

/**
 * Get all Resources
 *
 * @returns {Promise}
 */
export function allResources () {
  return _promisifyCallback(_getDB(TYPE_RESOURCE), 'find', {});
}

/**
 * Find resources by query
 *
 * @returns {Promise}
 */
export function findResources (query) {
  return _promisifyCallback(_getDB(TYPE_RESOURCE), 'find', query);
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
  const rawDocs = await _promisifyCallback(_getDB(TYPE_RESOURCE), 'find', {id});
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
  return _promisifyCallback(_getDB(TYPE_RESOURCE), 'insert', newResource);
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
    _getDB(TYPE_RESOURCE),
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
  return _promisifyCallback(_getDB(TYPE_RESOURCE), 'remove', {_id: resource._id});
}

/**
 * Get ResourceGroupConfig by ResourceGroupId
 *
 * @param resourceGroupId
 * @returns {null}
 */
export async function getResourceGroupConfigByResourceGroupId (resourceGroupId) {
  const rawDocs = _promisifyCallback(
    _getDB(TYPE_RESOURCE_GROUP_CONFIG),
    'find',
    {resourceGroupId}
  );
  return rawDocs.length >= 1 ? rawDocs[0] : null;
}

// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //

let _database = null;
function _getDB (type) {
  if (!_database) {
    const basePath = electron.remote.app.getPath('userData');
    _database = {};

    // NOTE: Do not EVER change this. EVER!
    const resourcePath = fsPath.join(basePath, 'sync/Resource.db');
    const resourceGroupConfigPath = fsPath.join(basePath, 'sync/ResourceGroupConfig.db');

    // Fill in the defaults
    _database['Resource'] = new NeDB({filename: resourcePath, autoload: true});
    _database['ResourceGroupConfig'] = new NeDB({filename: resourceGroupConfigPath, autoload: true});

    // Done
    console.log(`-- Initialize Sync DB at ${basePath} --`);
  }

  return _database[type];
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
