import electron from 'electron';
import * as fsPath from 'path';
import * as fs from 'fs';

import * as methods from '../lib/constants';
import {generateId} from './util';
import {PREVIEW_MODE_SOURCE} from '../lib/previewModes';
import {CONTENT_TYPE_TEXT} from '../lib/contentTypes';
import {DB_PERSIST_INTERVAL, DEFAULT_SIDEBAR_WIDTH} from '../lib/constants';

export const TYPE_SETTINGS = 'Settings';
export const TYPE_WORKSPACE = 'Workspace';
export const TYPE_REQUEST_GROUP = 'RequestGroup';
export const TYPE_REQUEST = 'Request';
export const TYPE_RESPONSE = 'Response';

const MODEL_DEFAULTS = {
  [TYPE_SETTINGS]: () => ({
    showPasswords: true,
    useBulkHeaderEditor: false,
    followRedirects: true,
    editorFontSize: 11,
    editorLineWrapping: true,
    timeout: -1
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
    contentType: CONTENT_TYPE_TEXT,
    body: '',
    parameters: [],
    headers: [],
    authentication: {},
    metaPreviewMode: PREVIEW_MODE_SOURCE,
    metaSortKey: -1 * Date.now()
  }),
  [TYPE_RESPONSE]: () => ({
    statusCode: 0,
    statusMessage: '',
    contentType: 'text/plain',
    url: '',
    bytes: 0,
    millis: 0,
    headers: [],
    body: '',
    error: ''
  }),
};

let db = null;

function getDBFilePath () {
  const basePath = electron.remote.app.getPath('userData');
  return fsPath.join(basePath, 'insomnia.db.json');
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
    const dbPath = getDBFilePath();

    global.db = db = {
      created: Date.now(),
      entities: {}
    };

    fs.readFile(getDBFilePath(), 'utf8', (err, text) => {
      if (!err) {
        // TODO: Better error handling
        console.log('-- Restored DB from file --');
        try {
          Object.assign(db, JSON.parse(text));
        } catch (e) {
          console.error('Failed to parse DB file', e);
        }
      }

      // Fill in the defaults

      const modelTypes = Object.keys(MODEL_DEFAULTS);
      modelTypes.map(t => {
        db.entities[t] = db.entities[t] || {};
      });

      // Add listeners to do persistence
      let timeout = null;
      onChange('DB_WRITER', () => {
        clearTimeout(timeout);
        timeout = setTimeout(persistDB, DB_PERSIST_INTERVAL);
      });

      // Done

      initialized = true;
      console.log(`-- Initialize DB at ${dbPath} --`);
      resolve();
    });
  })
}

function persistDB () {
  // First, write to a tmp file, then overwrite the old one. This
  // prevents getting a corrupted
  const filePath = getDBFilePath();
  const tmpFilePath = `${filePath}.tmp`;

  const start = Date.now();
  const blob = JSON.stringify(db, null, '\t');
  const bytes = Buffer.byteLength(blob, 'utf8');
  const megabytes = Math.round(bytes / 1024 / 1024 * 10) / 10;

  fs.writeFile(tmpFilePath, blob, err => {
    if (err) {
      console.error('Failed to write DB to file', err);
    } else {
      fs.renameSync(tmpFilePath, filePath);

      console.log(`-- Persisted DB in ${Date.now() - start}ms (${megabytes}MB) --`);
    }
  })
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

export function find (type, key, value) {
  const docs = [];
  Object.keys(db.entities[type]).map(id => {
    const doc = db.entities[type][id];
    if (doc[key] === value) {
      docs.push(doc);
    }
  });
  return new Promise(resolve => resolve(docs));
}

export function get (type, id) {
  const rawDoc = db.entities[type][id];
  const modelDefaults = MODEL_DEFAULTS[type]();
  const doc = Object.assign({}, modelDefaults, rawDoc);
  return new Promise(resolve => resolve(doc));
}

function getWhere (type, key, value = '__ANY__') {
  const ids = Object.keys(db.entities[type]);
  let docs = [];

  for (let i = 0; i < ids.length; i++) {
    const doc = db.entities[type][ids[i]];
    const modelDefaults = MODEL_DEFAULTS[type]();

    if (value === '__ANY__' || doc[key] === value) {
      const rawDoc = db.entities[type][ids[i]];
      const doc = Object.assign({}, modelDefaults, rawDoc);
      docs.push(doc);
    }
  }

  return new Promise(resolve => resolve(docs));
}

function count (type) {
  const count = Object.keys(db.entities[type]).length;
  return new Promise(resolve => resolve(count));
}

function all (type) {
  return getWhere(type);
}

function removeWhere (type, key, value) {
  const ids = Object.keys(db.entities[type]);
  let numRemoved = 0;

  for (let i = 0; i < ids.length; i++) {
    const doc = db.entities[type][ids[i]];
    if (doc[key] === value) {
      numRemoved++;
      remove(doc);
    }
  }

  return new Promise(resolve => resolve(numRemoved));
}

function insert (doc) {
  db.entities[doc.type][doc._id] = doc;

  Object.keys(changeListeners).map(k => changeListeners[k]('insert', doc));
  return new Promise(resolve => resolve(doc));
}

function update (doc) {
  return new Promise((resolve, reject) => {
    // Only update if it exists in the DB
    if (db.entities[doc.type][doc._id]) {
      db.entities[doc.type][doc._id] = doc;
      Object.keys(changeListeners).map(k => changeListeners[k]('update', doc));
      resolve(doc);
    } else {
      reject(new Error(`Doc did not exist for update: ${doc._id}`));
    }
  });
}

function remove (doc) {
  delete db.entities[doc.type][doc._id];

  // Also remove children
  Object.keys(MODEL_DEFAULTS).map(type => removeWhere(type, 'parentId', doc._id));

  const wasLastDoc = db.entities[doc.type].length === 0;

  Object.keys(changeListeners).map(k => changeListeners[k]('remove', doc));
  return new Promise(resolve => resolve({wasLastDoc}));
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

  // Fake a promise
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
  return find(TYPE_REQUEST, 'parentId', parentId);
}

export function requestUpdate (request, patch) {
  return docUpdate(request, patch);
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
  return getWhere(TYPE_REQUEST_GROUP, 'parentId', parentId);
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
  return docCreate(TYPE_SETTINGS, 'sts', patch);
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
