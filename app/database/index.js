// import PouchDB from 'pouchdb';
import * as methods from '../lib/constants';
import {generateId} from './util'

export const TYPE_WORKSPACE = 'Workspace';
export const TYPE_REQUEST_GROUP = 'RequestGroup';
export const TYPE_REQUEST = 'Request';
export const TYPE_RESPONSE = 'Response';

// We have to include the web version of PouchDB in app.html because
// the NodeJS version defaults to LevelDB which is hard (impossible?)
// to get working in Electron apps
let db = new PouchDB('insomnia.db', {adapter: 'websql'});

// For browser console debugging
global.db = db;

let changeListeners = {};

export function onChange (id, callback) {
  console.log(`-- Added DB Listener ${id} -- `);
  changeListeners[id] = callback;
}

export function offChange (id) {
  console.log(`-- Removed DB Listener ${id} -- `);
  delete changeListeners[id];
}

db.changes({
  since: 'now',
  live: true,
  include_docs: true,
  return_docs: false
}).on('change', function (res) {
  Object.keys(changeListeners).map(id => changeListeners[id](res))
}).on('complete', function (info) {
  console.log('complete', info);
}).on('error', function (err) {
  console.log('error', err);
});

/**
 * Initialize the database. This should be called once on app start.
 * @returns {Promise}
 */
export function initDB () {
  console.log('-- Initializing Database --');
  return Promise.all([
    db.createIndex({index: {fields: ['parentId']}}),
    db.createIndex({index: {fields: ['type']}}),
    db.createIndex({index: {fields: ['activated', 'type']}})
  ]).catch(err => {
    console.error('Failed to PouchDB Indexes', err);
  });
}

export function get (id) {
  return db.get(id);
}

export function update (doc, patch = {}) {
  const updatedDoc = Object.assign(
    {},
    doc,
    patch,
    {modified: Date.now()}
  );

  return db.put(updatedDoc).catch(e => {
    if (e.status === 409) {
      console.warn('Retrying document update for', updatedDoc);

      get(doc._id).then(dbDoc => {
        update(dbDoc, patch);
      });
    }
  });
}

export function getChildren (doc) {
  const parentId = doc._id;
  return db.find({selector: {parentId}});
}

export function removeChildren (doc) {
  return getChildren(doc).then(res => res.docs.map(remove));
}

export function remove (doc) {
  return Promise.all([
    update(doc, {_deleted: true}),
    removeChildren(doc)
  ]);
}

// ~~~~~~~~~~~~~~~~~~~ //
// DEFAULT MODEL STUFF //
// ~~~~~~~~~~~~~~~~~~~ //

function modelCreate (type, idPrefix, defaults, patch = {}) {
  const baseDefaults = {
    parentId: null
  };

  const model = Object.assign(
    baseDefaults,
    defaults,
    patch,

    // Required Generated Fields
    {
      _id: generateId(idPrefix),
      _rev: undefined,
      type: type,
      created: Date.now(),
      modified: Date.now()
    }
  );

  update(model);
  return model;
}

// ~~~~~~~ //
// REQUEST //
// ~~~~~~~ //

export function requestCreate (patch = {}) {
  return modelCreate(TYPE_REQUEST, 'req', {
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

export function requestCopy (request) {
  const name = `${request.name} (Copy)`;
  return requestCreate(Object.assign({}, request, {name}));
}


// ~~~~~~~~~~~~~ //
// REQUEST GROUP //
// ~~~~~~~~~~~~~ //

export function requestGroupCreate (patch = {}) {
  return modelCreate(TYPE_REQUEST_GROUP, 'grp', {
    collapsed: false,
    name: 'New Request Group',
    environment: {}
  }, patch);
}

// ~~~~~~~~ //
// RESPONSE //
// ~~~~~~~~ //

export function responseCreate (patch = {}) {
  return modelCreate(TYPE_RESPONSE, 'res', {
    statusCode: 0,
    statusMessage: '',
    contentType: 'text/plain',
    bytes: 0,
    millis: 0,
    headers: {},
    body: ''
  }, patch);
}


// ~~~~~~~~~ //
// WORKSPACE //
// ~~~~~~~~~ //

export function workspaceCreate (patch = {}) {
  return modelCreate(TYPE_WORKSPACE, 'wrk', {
    name: 'New Workspace',
    activeRequestId: null,
    activated: Date.now(), // TODO: Delete this property (replace with something better)
    environments: []
  }, patch);
}

export function workspaceActivate (workspace) {
  return update(workspace, {activated: Date.now()});
}

export function workspaceAll () {
  return db.find({
    selector: {type: 'Workspace'}
  })
}

export function workspaceGetActive () {
  return db.find({
    selector: {
      activated: {$gte: 0}, // HACK: because can't use $exists here?
      type: {$eq: 'Workspace'}
    },
    sort: [{activated: 'desc'}],
    limit: 1
  })
}


// ~~~~~~~~ //
// SETTINGS //
// ~~~~~~~~ //

// TODO: This
// export function settingsCreate (patch = {}) {
//   return modelCreate('Settings', 'set', {
//     editorLineWrapping: false,
//     editorLineNumbers: true
//   }, patch);
// }
