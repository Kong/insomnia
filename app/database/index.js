import electron from 'electron';
import * as fsPath from 'path';
import * as fs from 'fs';

import * as methods from '../lib/constants';
import {generateId} from './util';
import {PREVIEW_MODE_SOURCE} from '../lib/previewModes';
import {CONTENT_TYPE_TEXT} from '../lib/contentTypes';
import {DB_PERSIST_INTERVAL, DEFAULT_SIDEBAR_WIDTH} from '../lib/constants';

export const TYPE_WORKSPACE = 'Workspace';
export const TYPE_REQUEST_GROUP = 'RequestGroup';
export const TYPE_REQUEST = 'Request';
export const TYPE_RESPONSE = 'Response';
const TYPES = [
  TYPE_WORKSPACE,
  TYPE_REQUEST_GROUP,
  TYPE_REQUEST,
  TYPE_RESPONSE
];

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

    for (let i = 0; i < TYPES.length; i++) {
      db.entities[TYPES[i]] = {};
    }

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
  const doc = db.entities[type][id];
  return new Promise(resolve => resolve(doc));
}

export function getFromMany (types, id) {
  const docs = [];

  types.map(t => {
    const doc = db.entities[t][id];
    doc && docs.push(doc);
  });

  return new Promise(resolve => resolve(docs));
}

function all (type) {
  let docs = [];
  const ids = Object.keys(db.entities[type]);
  for (let i = 0; i < ids.length; i++) {
    docs.push(db.entities[type][ids[i]]);
  }

  return new Promise(resolve => resolve(docs));
}

function count (type) {
  const count = Object.keys(db.entities[type]).length;
  return new Promise(resolve => resolve(count));
}

function removeWhere (type, key, value) {
  const ids = Object.keys(db.entities[type]);
  let docs = [];

  for (let i = 0; i < ids.length; i++) {
    const doc = db.entities[type][ids[i]];
    if (doc[key] === value) {
      remove(doc);
    }
  }

  return new Promise(resolve => resolve(docs));
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
  TYPES.map(type => removeWhere(type, 'parentId', doc._id));

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

function docCreate (type, idPrefix, defaults, patch = {}) {
  const baseDefaults = {
    parentId: null
  };

  const doc = Object.assign(
    baseDefaults,
    defaults,
    patch,

    // Required Generated Fields
    {
      _id: generateId(idPrefix),
      meta: undefined,
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
    workspaceUpdate(workspace, {activeRequestId: r._id});
  })
}

export function requestCopyAndActivate (workspace, request) {
  return requestCopy(request).then(r => {
    workspaceUpdate(workspace, {activeRequestId: r._id});
  })
}

export function requestCreate (patch = {}) {
  return docCreate(TYPE_REQUEST, 'req', {
    url: '',
    name: 'New Request',
    method: methods.METHOD_GET,
    previewMode: PREVIEW_MODE_SOURCE,
    contentType: CONTENT_TYPE_TEXT,
    body: '',
    params: [],
    headers: [],
    authentication: {},

    // Always put new request at the top
    sortKey: -1 * Date.now()
  }, patch);
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
  return docCreate(TYPE_REQUEST_GROUP, 'grp', {
    collapsed: false,
    name: 'New Request Group',
    environment: {}
  }, patch);
}

export function requestGroupUpdate (requestGroup, patch) {
  return docUpdate(requestGroup, patch);
}

export function requestGroupById (id) {
  return get(TYPE_REQUEST_GROUP, id);
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
  return docCreate(TYPE_RESPONSE, 'res', {
    statusCode: 0,
    statusMessage: '',
    contentType: 'text/plain',
    url: '',
    bytes: 0,
    millis: 0,
    headers: [],
    body: '',
    error: ''
  }, patch);
}

export function responseAll () {
  return all(TYPE_RESPONSE);
}


// ~~~~~~~~~ //
// WORKSPACE //
// ~~~~~~~~~ //

export function workspaceCreate (patch = {}) {
  return docCreate(TYPE_WORKSPACE, 'wrk', {
    name: 'New Workspace',
    activeRequestId: null,
    environments: [],
    sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    filter: ''
  }, patch);
}

export function workspaceAll () {
  return all(TYPE_WORKSPACE).then(workspaces => {
    if (workspaces.length === 0) {
      workspaceCreate({name: 'Insomnia'});
      return workspaceAll();
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
