import * as fsPath from 'path'
import electron from 'electron'
import Loki from 'lokijs'

import * as methods from '../lib/constants'
import {generateId} from './util'
import {CONTENT_TYPE_TEXT} from '../lib/contentTypes'
import {PREVIEW_MODE_FRIENDLY} from '../lib/previewModes'

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
    db = new Loki(dbPath, {
      autoload: true,
      autosave: true,
      autosaveInterval: 300, // TODO: do a final save on close
      persistenceMethod: 'fs',
      autoloadCallback () {
        TYPES.map(type => {
          let collection = db.getCollection(type);
          if (!collection) {
            collection = db.addCollection(type, {
              indices: ['_id'],
              asyncListeners: false,
              disableChangesApi: true, // Don't need this yet
              clone: true, // Clone objects on save
              transactional: true
            });

            collection.ensureUniqueIndex('_id');

            console.log(`-- Initialize DB Collection ${type} --`)
          }

          collection.on('update', doc => {
            Object.keys(changeListeners).map(k => changeListeners[k]('update', doc));
          });

          collection.on('insert', doc => {
            Object.keys(changeListeners).map(k => changeListeners[k]('insert', doc));
          });

          collection.on('delete', doc => {
            Object.keys(changeListeners).map(k => changeListeners[k]('delete', doc));
          });
        });

        resolve();
        initialized = true;
        console.log(`-- Initialize DB at ${dbPath} --`);
      }
    });
    global.db = db;
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

export function get (type, id) {
  const doc = db.getCollection(type).by('_id', id);
  return new Promise(resolve => resolve(doc));
}

function find (type, query) {
  const docs = db.getCollection(type).find(query);
  return new Promise(resolve => resolve(docs));
}

function insert (doc) {
  const newDoc = db.getCollection(doc.type).insert(doc);
  return new Promise(resolve => resolve(newDoc));
}

function update (doc) {
  // NOTE: LokiJS only holds references to objects in its DB. This means we need to fetch the
  // old reference and update it because that's the only way.
  return get(doc.type, doc._id).then(oldDoc => {
    Object.assign(oldDoc, doc);
    db.getCollection(doc.type).update(oldDoc);
    return new Promise(resolve => resolve(oldDoc));
  });
}

function remove (doc) {
  db.getCollection(doc.type).remove(doc);

  // Also remove children
  TYPES.map(type => db.getCollection(type).removeWhere({parentId: doc._id}));

  new Promise(resolve => resolve());
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

  // Fake a promise
  const finalDoc = update(doc);
  return new Promise(resolve => resolve(finalDoc));
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
      $loki: undefined,
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

export function requestCreate (patch = {}) {
  return docCreate(TYPE_REQUEST, 'req', {
    url: '',
    name: 'New Request',
    method: methods.METHOD_GET,
    activated: Date.now(),
    previewMode: PREVIEW_MODE_FRIENDLY,
    contentType: CONTENT_TYPE_TEXT,
    body: '',
    params: [],
    headers: [],
    authentication: {}
  }, patch);
}

export function requestById (id) {
  return get(TYPE_REQUEST, id);
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
  return find(TYPE_REQUEST, {});
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
  return find(TYPE_REQUEST_GROUP, {});
}

// ~~~~~~~~ //
// RESPONSE //
// ~~~~~~~~ //

export function responseCreate (patch = {}) {
  return docCreate(TYPE_RESPONSE, 'res', {
    statusCode: 0,
    statusMessage: '',
    contentType: 'text/plain',
    bytes: 0,
    millis: 0,
    headers: [],
    body: ''
  }, patch);
}

export function responseAll () {
  return find(TYPE_RESPONSE, {});
}


// ~~~~~~~~~ //
// WORKSPACE //
// ~~~~~~~~~ //

export function workspaceCreate (patch = {}) {
  return docCreate(TYPE_WORKSPACE, 'wrk', {
    name: 'New Workspace',
    activeRequestId: null,
    environments: []
  }, patch);
}

export function workspaceAll () {
  return find(TYPE_WORKSPACE, {}).then(workspaces => {
    if (workspaces.length === 0) {
      workspaceCreate({name: 'Insomnia'});
      return workspaceAll();
    } else {
      return new Promise(resolve => resolve(workspaces))
    }
  });
}

export function workspaceUpdate (workspace, patch) {
  return docUpdate(workspace, patch);
}

export function workspaceRemove (workspace) {
  return remove(workspace);
}
