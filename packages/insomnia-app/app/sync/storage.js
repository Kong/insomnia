import electron from 'electron';
import NeDB from 'nedb';
import fsPath from 'path';
import crypto from 'crypto';
import * as util from '../common/misc';
import { DB_PERSIST_INTERVAL } from '../common/constants';

const TYPE_RESOURCE = 'Resource';
const TYPE_CONFIG = 'Config';

export const SYNC_MODE_OFF = 'paused';
export const SYNC_MODE_ON = 'active';
export const SYNC_MODE_NEVER = 'never';
export const SYNC_MODE_UNSET = 'unset';
let changeListeners = [];

export function onChange(callback) {
  changeListeners.push(callback);
}

export function offChange(callback) {
  changeListeners = changeListeners.filter(l => l !== callback);
}

let _changeTimeout = null;
function _notifyChange() {
  clearTimeout(_changeTimeout);
  _changeTimeout = setTimeout(() => {
    for (const fn of changeListeners) {
      fn();
    }
  }, 200);
}

export function allActiveResources(resourceGroupId = null) {
  if (resourceGroupId) {
    return findActiveResources({ resourceGroupId });
  } else {
    return findActiveResources({});
  }
}

export function activeResourcesForResourceGroup(resourceGroupId) {
  return findActiveResources({ resourceGroupId });
}

export function allResources() {
  return findResources({});
}

export async function findResources(query = {}) {
  return _execDB(TYPE_RESOURCE, 'find', query);
}

export async function findActiveResources(query) {
  const configs = await findActiveConfigs();
  const resourceGroupIds = configs.map(c => c.resourceGroupId);
  return findResources(
    Object.assign({ resourceGroupId: { $in: resourceGroupIds } }, query)
  );
}

export async function findActiveDirtyResources() {
  return findActiveResources({ dirty: true });
}

export async function findActiveDirtyResourcesForResourceGroup(
  resourceGroupId
) {
  return findActiveResources({ dirty: true, resourceGroupId });
}

export async function findDirtyResourcesForResourceGroup(resourceGroupId) {
  return findResources({ dirty: true, resourceGroupId });
}

export async function findResourcesForResourceGroup(resourceGroupId) {
  return findResources({ resourceGroupId });
}

export async function getResourceByDocId(id, resourceGroupId = null) {
  let query;
  if (resourceGroupId) {
    query = { id, resourceGroupId };
  } else {
    query = { id };
  }

  const rawDocs = await _execDB(TYPE_RESOURCE, 'find', query);
  return rawDocs.length >= 1 ? rawDocs[0] : null;
}

/**
 * This function is temporary and should only be called when cleaning
 * up duplicate ResourceGroups
 * @param id
 * @returns {*}
 */
export function findResourcesByDocId(id) {
  return _execDB(TYPE_RESOURCE, 'find', { id });
}

/**
 * This function is temporary and should only be called when cleaning
 * up duplicate ResourceGroups
 * @param resourceGroupId
 * @returns {*}
 */
export async function removeResourceGroup(resourceGroupId) {
  await _execDB(TYPE_RESOURCE, 'remove', { resourceGroupId }, { multi: true });
  await _execDB(TYPE_CONFIG, 'remove', { resourceGroupId }, { multi: true });
  _notifyChange();
}

export async function insertResource(resource) {
  const h = crypto.createHash('md5');
  h.update(resource.resourceGroupId);
  h.update(resource.id);
  const newResource = Object.assign({}, resource, {
    _id: `rs_${h.digest('hex')}`
  });
  await _execDB(TYPE_RESOURCE, 'insert', newResource);
  _notifyChange();
  return newResource;
}

export async function updateResource(resource, ...patches) {
  const newDoc = Object.assign({}, resource, ...patches);
  await _execDB(TYPE_RESOURCE, 'update', { _id: resource._id }, newDoc, {
    multi: true
  });
  _notifyChange();
  return newDoc;
}

export async function removeResource(resource) {
  await _execDB(
    TYPE_RESOURCE,
    'remove',
    { _id: resource._id },
    { multi: true }
  );
  _notifyChange();
}

// ~~~~~~ //
// Config //
// ~~~~~~ //

export function findConfigs(query) {
  return _execDB(TYPE_CONFIG, 'find', query);
}

export function allConfigs() {
  return findConfigs({});
}

export function findInactiveConfigs(excludedResourceGroupId = null) {
  if (excludedResourceGroupId) {
    return findConfigs({
      $not: { syncMode: SYNC_MODE_ON, excludedResourceGroupId }
    });
  } else {
    return findConfigs({ $not: { syncMode: SYNC_MODE_ON } });
  }
}

export function findActiveConfigs(resourceGroupId = null) {
  if (resourceGroupId) {
    return findConfigs({ syncMode: SYNC_MODE_ON, resourceGroupId });
  } else {
    return findConfigs({ syncMode: SYNC_MODE_ON });
  }
}

export async function getConfig(resourceGroupId) {
  const rawDocs = await _execDB(TYPE_CONFIG, 'find', { resourceGroupId });
  return rawDocs.length >= 1 ? _initConfig(rawDocs[0]) : null;
}

export async function updateConfig(config, ...patches) {
  const doc = _initConfig(Object.assign(config, ...patches));
  await _execDB(TYPE_CONFIG, 'update', { _id: doc._id }, doc);
  return doc;
}

export function removeConfig(config) {
  return _execDB(TYPE_CONFIG, 'remove', { _id: config._id });
}

export async function insertConfig(config) {
  const doc = _initConfig(config);
  await _execDB(TYPE_CONFIG, 'insert', doc);
  return doc;
}

function _initConfig(data) {
  return Object.assign(
    {
      _id: util.generateId('scf'),
      syncMode: SYNC_MODE_UNSET,
      resourceGroupId: null
    },
    data
  );
}

export function initDB(config, forceReset) {
  if (!_database || forceReset) {
    const basePath = electron.remote.app.getPath('userData');
    _database = {};

    // NOTE: Do not EVER change this. EVER!
    const resourcePath = fsPath.join(basePath, 'sync/Resource.db');
    const configPath = fsPath.join(basePath, 'sync/Config.db');

    // Fill in the defaults
    _database['Resource'] = new NeDB(
      Object.assign({ filename: resourcePath, autoload: true }, config)
    );

    _database['Config'] = new NeDB(
      Object.assign({ filename: configPath, autoload: true }, config)
    );

    for (const key of Object.keys(_database)) {
      _database[key].persistence.setAutocompactionInterval(DB_PERSIST_INTERVAL);
    }

    // Done
    console.log(`[sync] Initialize Sync DB at ${basePath}`);
  }
}

// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //

let _database = null;

function _getDB(type, config = {}) {
  initDB(config);
  return _database[type];
}

function _execDB(type, fnName, ...args) {
  return new Promise((resolve, reject) => {
    _getDB(type)[fnName](...args, (err, data) => {
      err ? reject(err) : resolve(data);
    });
  });
}
