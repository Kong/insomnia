import electron from 'electron';
import NeDB from 'nedb';
import fsPath from 'path';
import crypto from 'crypto';
import * as util from '../util';

const TYPE_RESOURCE = 'Resource';
const TYPE_CONFIG = 'Config';

export const SYNC_MODE_OFF = 'paused';
export const SYNC_MODE_ON = 'active';

export function activeResources () {
  return findActiveResources({});
}

export function activeResourcesForResourceGroup (resourceGroupId) {
  return findActiveResources({resourceGroupId});
}

export function allResources () {
  return findResources({});
}

export async function findResources (query) {
  return _promisifyCallback(_getDB(TYPE_RESOURCE), 'find', query);
}

export async function findActiveResources (query) {
  const configs = await findActiveConfigs();
  const resourceGroupIds = configs.map(c => c.resourceGroupId);
  return findResources(Object.assign({resourceGroupId: {$in: resourceGroupIds}}, query));
}

export async function findActiveDirtyResources () {
  return findActiveResources({dirty: true});
}

export async function findActiveDirtyResourcesForResourceGroup (resourceGroupId) {
  return findActiveResources({dirty: true, resourceGroupId});
}

export async function findResourcesForResourceGroup (resourceGroupId) {
  return findResources({resourceGroupId});
}

export async function getResourceById (id) {
  const rawDocs = await _promisifyCallback(_getDB(TYPE_RESOURCE), 'find', {id});
  return rawDocs.length >= 1 ? rawDocs[0] : null;
}

export async function insertResource (resource) {
  const h = crypto.createHash('md5');
  h.update(resource.resourceGroupId);
  h.update(resource.id);
  const newResource = Object.assign({}, resource, {_id: `rs_${h.digest('hex')}`});
  await _promisifyCallback(_getDB(TYPE_RESOURCE), 'insert', newResource);
  return newResource;
}

export async function updateResource (resource, ...patches) {
  const newDoc = Object.assign(resource, ...patches);
  await _promisifyCallback(_getDB(TYPE_RESOURCE), 'update', {_id: resource._id}, newDoc);
  return newDoc
}

export function removeResource (resource) {
  return _promisifyCallback(_getDB(TYPE_RESOURCE), 'remove', {_id: resource._id});
}

// ~~~~~~ //
// Config //
// ~~~~~~ //

export function findConfigs (query) {
  return _promisifyCallback(_getDB(TYPE_CONFIG), 'find', query)
}

export function allConfigs () {
  return findConfigs({})
}

export function findInactiveConfigs (excludedResourceGroupId = null) {
  if (excludedResourceGroupId) {
    return findConfigs({syncMode: SYNC_MODE_OFF, $not: {excludedResourceGroupId}})
  } else {
    return findConfigs({syncMode: SYNC_MODE_OFF})
  }
}

export function findActiveConfigs (resourceGroupId = null) {
  if (resourceGroupId) {
    return findConfigs({syncMode: SYNC_MODE_ON, resourceGroupId})
  } else {
    return findConfigs({syncMode: SYNC_MODE_ON})
  }
}

export async function getConfig (resourceGroupId) {
  const rawDocs = await _promisifyCallback(_getDB(TYPE_CONFIG), 'find', {resourceGroupId});
  return rawDocs.length >= 1 ? _initConfig(rawDocs[0]) : null;
}

export async function updateConfig (config, ...patches) {
  const doc = _initConfig(Object.assign(config, ...patches));
  await _promisifyCallback(
    _getDB(TYPE_CONFIG),
    'update',
    {_id: doc._id},
    doc
  );
  return doc;
}

export function removeConfig (config) {
  return _promisifyCallback(_getDB(TYPE_CONFIG), 'remove', {_id: config._id});
}

export async function insertConfig (config) {
  const doc = _initConfig(config);
  await _promisifyCallback(_getDB(TYPE_CONFIG), 'insert', doc);
  return doc;
}

function _initConfig (data) {
  return Object.assign({
    _id: util.generateId('scf'),
    syncMode: SYNC_MODE_ON,
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
