import electron from 'electron';
import NeDB from 'nedb';
import fsPath from 'path';
import crypto from 'crypto';
import * as util from '../util';

const TYPE_RESOURCE = 'Resource';
const TYPE_CONFIG = 'Config';

export const SYNC_MODE_OFF = 'off';
export const SYNC_MODE_ON = 'on';

/**
 * Get all Resources
 *
 * @returns {Promise}
 */
export function activeResources () {
  return findActiveResources({});
}

/**
 * Find resources by query
 *
 * @returns {Promise}
 */
export async function findActiveResources (query) {
  const configs = await findActiveConfigs();
  const resourceGroupIds = configs.map(c => c.resourceGroupId);
  query.resourceGroupId = {$in: resourceGroupIds};
  return _promisifyCallback(_getDB(TYPE_RESOURCE), 'find', query);
}

/**
 * Get all dirty resources
 * @returns {Promise}
 */
export async function findActiveDirtyResources () {
  return findActiveResources({dirty: true});
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
export async function insertResource (resource) {
  const h = crypto.createHash('md5');
  h.update(resource.resourceGroupId);
  h.update(resource.id);
  const newResource = Object.assign({}, resource, {_id: `rs_${h.digest('hex')}`});
  await _promisifyCallback(_getDB(TYPE_RESOURCE), 'insert', newResource);
  return newResource;
}

/**
 * Update an existing resource
 *
 * @param resource
 * @param patches
 * @returns {Promise}
 */
export async function updateResource (resource, ...patches) {
  const newDoc = Object.assign(resource, ...patches);
  await _promisifyCallback(_getDB(TYPE_RESOURCE), 'update', {_id: resource._id}, newDoc);
  return newDoc
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

// ~~~~~~ //
// Config //
// ~~~~~~ //

/**
 * Get Config
 *
 * @param resourceGroupId
 */
export async function getConfig (resourceGroupId) {
  const rawDocs = await _promisifyCallback(_getDB(TYPE_CONFIG), 'find', {resourceGroupId});
  return rawDocs.length >= 1 ? _defaultConfig(rawDocs[0]) : null;
}

/**
 * Save a Config
 * @param config
 * @param patches
 */
export async function updateConfig (config, ...patches) {
  const newDoc = Object.assign(config, ...patches);
  await _promisifyCallback(
    _getDB(TYPE_CONFIG),
    'update',
    {_id: newDoc._id},
    newDoc
  );
  return newDoc;
}

/**
 * Get all the active configs
 */
export function findActiveConfigs () {
  return _promisifyCallback(_getDB(TYPE_CONFIG), 'find', {$not: {syncMode: SYNC_MODE_OFF}})
}

export async function insertConfig (config) {
  const id = util.generateId('scf');
  const doc = Object.assign({_id: id}, config);
  await _promisifyCallback(_getDB(TYPE_CONFIG), 'insert', config);
  return doc;
}

function _defaultConfig (data) {
  return Object.assign({
    syncMode: SYNC_MODE_OFF,
    resourceGroupId: null
  }, data);
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
    const configPath = fsPath.join(basePath, 'sync/Config.db');

    // Fill in the defaults
    _database['Resource'] = new NeDB({filename: resourcePath, autoload: true});
    _database['Config'] = new NeDB({
      filename: configPath,
      autoload: true
    });

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
