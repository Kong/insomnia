// import PouchDB from 'pouchdb';
import * as methods from '../lib/constants';
import {generateId} from './util'
import Loki from 'lokijs'

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
    db = new Loki('insomnia.db.json', {
      autoload: true,
      autosave: true,
      autosaveInterval: 500, // TODO: Make this a bit smarter maybe
      persistenceMethod: 'fs',
      autoloadCallback () {
        TYPES.map(type => {
          let collection = db.getCollection(type);
          if (!collection) {
            collection = db.addCollection(type, {
              asyncListeners: false,
              clone: false,
              disableChangesApi: false,
              transactional: false
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
      }
    });
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
  const newDoc = db.getCollection(doc.type).update(doc);
  return new Promise(resolve => resolve(newDoc));
}

function remove (doc) {
  const newDoc = db.getCollection(doc.type).remove(doc);
  return new Promise(resolve => resolve(newDoc));
}

export function getChildren (doc) {
  return [];
  // const parentId = doc._id;
  // return db.find({selector: {parentId}});
}

export function removeChildren (doc) {
  return [];
  // return getChildren(doc).then(res => res.docs.map(remove));
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
    body: '',
    params: [],
    contentType: 'text/plain',
    headers: [],
    authentication: {}
  }, patch);
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
