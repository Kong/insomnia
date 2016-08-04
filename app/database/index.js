import electron from 'electron';
import NeDB from 'nedb';
import * as fsPath from 'path';

import * as methods from '../lib/constants';
import {generateId} from './util';
import {PREVIEW_MODE_SOURCE} from '../lib/previewModes';
import {DB_PERSIST_INTERVAL, DEFAULT_SIDEBAR_WIDTH} from '../lib/constants';
import {CONTENT_TYPE_TEXT} from '../lib/contentTypes';

export const TYPE_STATS = 'Stats';
export const TYPE_SETTINGS = 'Settings';
export const TYPE_WORKSPACE = 'Workspace';
export const TYPE_REQUEST_GROUP = 'RequestGroup';
export const TYPE_REQUEST = 'Request';
export const TYPE_RESPONSE = 'Response';


const MODEL_DEFAULTS = {
  [TYPE_STATS]: () => ({
    lastLaunch: Date.now(),
    lastVersion: null,
    launches: 0
  }),
  [TYPE_SETTINGS]: () => ({
    showPasswords: true,
    useBulkHeaderEditor: false,
    followRedirects: false,
    editorFontSize: 11,
    editorLineWrapping: true,
    timeout: 0,
    validateSSL: true
  }),
  [TYPE_WORKSPACE]: () => ({
    name: 'New Workspace',
    environments: [],
    filter: '',
    metaSidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    metaActiveRequestId: null
  }),
  [TYPE_REQUEST_GROUP]: () => ({
    name: 'New Folder',
    environment: {},
    metaCollapsed: false,
    metaSortKey: -1 * Date.now()
  }),
  [TYPE_REQUEST]: () => ({
    url: '',
    name: 'New Request',
    method: methods.METHOD_GET,
    body: '',
    parameters: [],
    headers: [{
      name: 'Content-Type',
      value: CONTENT_TYPE_TEXT
    }],
    authentication: {},
    metaPreviewMode: PREVIEW_MODE_SOURCE,
    metaSortKey: -1 * Date.now()
  }),
  [TYPE_RESPONSE]: () => ({
    statusCode: 0,
    statusMessage: '',
    contentType: 'text/plain',
    url: '',
    bytesRead: 0,
    elapsedTime: 0,
    headers: [],
    body: '',
    error: ''
  }),
};

let db = null;

function getDBFilePath (modelType) {
  // NOTE: Do not EVER change this. EVER!
  const basePath = electron.remote.app.getPath('userData');
  return fsPath.join(basePath, `insomnia.${modelType}.db`);
}

/**
 * Initialize the database. This should be called once on app start.
 * @returns {Promise}
 */
let initialized = false;
export function initDB () {
  // Only init once
  if (initialized) {
    return new Promise(resolve => resolve());
  }

  return new Promise(resolve => {
    global.db = db = {};

    // Fill in the defaults

    const modelTypes = Object.keys(MODEL_DEFAULTS);
    modelTypes.map(t => {
      const filename = getDBFilePath(t);
      const autoload = true;

      db[t] = new NeDB({filename, autoload});
      db[t].persistence.setAutocompactionInterval(DB_PERSIST_INTERVAL)
    });

    // Done

    initialized = true;
    console.log(`-- Initialize DB at ${getDBFilePath('t')} --`);
    resolve();
  });
}

let changeListeners = {};

export function onChange (id, callback) {
  console.log(`-- Added DB Listener ${id} -- `);
  changeListeners[id] = callback;
}

export function offChange (id) {
  console.log(`-- Removed DB Listener ${id} -- `);
  delete changeListeners[id];
}

function find (type, query = {}) {
  return new Promise((resolve, reject) => {
    db[type].find(query, (err, rawDocs) => {
      if (err) {
        return reject(err);
      }

      const modelDefaults = MODEL_DEFAULTS[type]();
      const docs = rawDocs.map(rawDoc => {
        return Object.assign({}, modelDefaults, rawDoc);
      });

      resolve(docs);
    });
  });
}

function all (type) {
  return find(type);
}

function getWhere (type, query) {
  return new Promise((resolve, reject) => {
    db[type].find(query, (err, rawDocs) => {
      if (err) {
        return reject(err);
      }

      if (rawDocs.length === 0) {
        // Not found. Too bad!
        return resolve(null);
      }

      const modelDefaults = MODEL_DEFAULTS[type]();
      resolve(Object.assign({}, modelDefaults, rawDocs[0]));
    });
  });
}

function get (type, id) {
  return getWhere(type, {_id: id});
}

function count (type, query = {}) {
  return new Promise((resolve, reject) => {
    db[type].count(query, (err, count) => {
      if (err) {
        return reject(err);
      }

      resolve(count);
    });
  });
}

function insert (doc) {
  return new Promise((resolve, reject) => {
    db[doc.type].insert(doc, (err, newDoc) => {
      if (err) {
        return reject(err);
      }

      resolve(newDoc);
      Object.keys(changeListeners).map(k => changeListeners[k]('insert', doc));
    });
  });
}

function update (doc) {
  return new Promise((resolve, reject) => {
    db[doc.type].update({_id: doc._id}, doc, err => {
      if (err) {
        return reject(err);
      }

      resolve();
      Object.keys(changeListeners).map(k => changeListeners[k]('update', doc));
    });
  });
}

function remove (doc) {
  return new Promise((resolve, reject) => {
    // TODO: Remove all children as well
    db[doc.type].remove({_id: doc._id}, {multi: true}, err => {
      if (err) {
        return reject(err);
      }

      resolve();
      Object.keys(changeListeners).map(k => changeListeners[k]('remove', doc));
    });
  });
}


// ~~~~~~~~~~~~~~~~~~~ //
// DEFAULT MODEL STUFF //
// ~~~~~~~~~~~~~~~~~~~ //

function docUpdate (originalDoc, patch = {}) {
  const doc = Object.assign(
    {},
    originalDoc,
    patch,
    {modified: Date.now()}
  );

  return update(doc);
}

function docCreate (type, idPrefix, patch = {}) {
  const baseDefaults = {
    parentId: null
  };

  const modelDefaults = MODEL_DEFAULTS[type]();

  const doc = Object.assign(
    baseDefaults,
    modelDefaults,
    patch,

    // Required Generated Fields
    {
      _id: generateId(idPrefix),
      type: type,
      created: Date.now(),
      modified: Date.now()
    }
  );

  return insert(doc);
}

// ~~~~~~~ //
// REQUEST //
// ~~~~~~~ //

export function requestCreateAndActivate (workspace, patch = {}) {
  return requestCreate(patch).then(r => {
    workspaceUpdate(workspace, {metaActiveRequestId: r._id});
  })
}

export function requestCopyAndActivate (workspace, request) {
  return requestCopy(request).then(r => {
    workspaceUpdate(workspace, {metaActiveRequestId: r._id});
  })
}

export function requestCreate (patch = {}) {
  if (!patch.parentId) {
    throw new Error('New Requests missing `parentId`', patch);
  }

  return docCreate(TYPE_REQUEST, 'req', patch);
}

export function requestGetById (id) {
  return get(TYPE_REQUEST, id);
}

export function requestFindByParentId (parentId) {
  return find(TYPE_REQUEST, {parentId: parentId});
}

export function requestUpdate (request, patch) {
  return docUpdate(request, patch);
}

export function requestUpdateContentType (request, contentType) {
  let headers = [...request.headers];
  const contentTypeHeader = headers.find(
    h => h.name.toLowerCase() === 'content-type'
  );

  if (!contentType) {
    // Remove the contentType header if we are unsetting it
    headers = headers.filter(h => h !== contentTypeHeader);
  } else if (contentTypeHeader) {
    contentTypeHeader.value = contentType;
  } else {
    headers.push({name: 'Content-Type', value: contentType})
  }

  return docUpdate(request, {headers});
}

export function requestCopy (request) {
  const name = `${request.name} (Copy)`;
  return requestCreate(Object.assign({}, request, {name}));
}

export function requestRemove (request) {
  return remove(request);
}

export function requestAll () {
  return all(TYPE_REQUEST);
}

export function requestGetAncestors (request) {
  return new Promise(resolve => {
    const ancestors = [];

    const next = (doc) => {
      Promise.all([
        requestGroupGetById(doc.parentId),
        workspaceGetById(doc.parentId)
      ]).then(([requestGroup, workspace]) => {
        if (requestGroup) {
          ancestors.push(requestGroup);
          next(requestGroup);
        } else if (workspace) {
          ancestors.push(workspace);
          next(workspace);
          // We could be done here, but let's have there only be one finish case
        } else {
          // We're finished
          resolve(ancestors);
        }
      });
    };

    next(request);
  });
}


// ~~~~~~~~~~~~~ //
// REQUEST GROUP //
// ~~~~~~~~~~~~~ //

export function requestGroupCreate (patch = {}) {
  if (!patch.parentId) {
    throw new Error('New Requests missing `parentId`', patch);
  }

  return docCreate(TYPE_REQUEST_GROUP, 'grp', patch);
}

export function requestGroupUpdate (requestGroup, patch) {
  return docUpdate(requestGroup, patch);
}

export function requestGroupGetById (id) {
  return get(TYPE_REQUEST_GROUP, id);
}

export function requestGroupFindByParentId (parentId) {
  return find(TYPE_REQUEST_GROUP, {parentId});
}

export function requestGroupRemove (requestGroup) {
  return remove(requestGroup);
}

export function requestGroupAll () {
  return all(TYPE_REQUEST_GROUP);
}

// ~~~~~~~~ //
// RESPONSE //
// ~~~~~~~~ //

export function responseCreate (patch = {}) {
  if (!patch.parentId) {
    throw new Error('New Requests missing `parentId`', patch);
  }

  return docCreate(TYPE_RESPONSE, 'res', patch);
}

export function responseAll () {
  return all(TYPE_RESPONSE);
}


// ~~~~~~~~~ //
// WORKSPACE //
// ~~~~~~~~~ //

export function workspaceGetById (id) {
  return get(TYPE_WORKSPACE, id);
}

export function workspaceCreate (patch = {}) {
  return docCreate(TYPE_WORKSPACE, 'wrk', patch);
}

export function workspaceAll () {
  return all(TYPE_WORKSPACE).then(workspaces => {
    if (workspaces.length === 0) {
      return workspaceCreate({name: 'Insomnia'}).then(workspaceAll);
    } else {
      return new Promise(resolve => resolve(workspaces))
    }
  });
}

export function workspaceCount () {
  return count(TYPE_WORKSPACE)
}

export function workspaceUpdate (workspace, patch) {
  return docUpdate(workspace, patch);
}

export function workspaceRemove (workspace) {
  return remove(workspace);
}


// ~~~~~~~~~ //
// WORKSPACE //
// ~~~~~~~~~ //

export function settingsCreate (patch = {}) {
  return docCreate(TYPE_SETTINGS, 'set', patch);
}

export function settingsUpdate (settings, patch) {
  return docUpdate(settings, patch);
}

export function settingsGet () {
  return all(TYPE_SETTINGS).then(results => {
    if (results.length === 0) {
      return settingsCreate().then(settingsGet);
    } else {
      return new Promise(resolve => resolve(results[0]));
    }
  });
}

// ~~~~ //
// USER //
// ~~~~ //

export function statsCreate (patch = {}) {
  return docCreate(TYPE_STATS, 'sta', patch);
}

export function statsUpdate (patch) {
  return statsGet().then(stats => {
    return docUpdate(stats, patch);
  });
}

export function statsGet () {
  return all(TYPE_STATS).then(results => {
    if (results.length === 0) {
      return statsCreate().then(statsGet);
    } else {
      return new Promise(resolve => resolve(results[0]));
    }
  });
}

export function statsIncrement (key) {
  return statsGet().then(stats => {
    if (stats[key] === undefined) {
      throw new Error(`Stats[${key}] doesn't exist for increment`);
    }

    const patch = {
      [key]: stats[key] + 1
    };

    return docUpdate(stats, patch);
  });
}
