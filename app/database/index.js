// import PouchDB from 'pouchdb';
import * as methods from '../constants/global';
import {generateId} from './util'

// We have to include the web version of PouchDB in app.html because
// the NodeJS version defaults to LevelDB which is hard (impossible?)
// to get working in Electron apps
let db = new PouchDB('insomnia.db', {adapter: 'websql'});

// For browser console debugging
global.db = db;

export let changes = db.changes({
  since: 'now',
  live: true,
  include_docs: true,
  return_docs: false
}).on('complete', function (info) {
  console.log('complete', info);
}).on('error', function (err) {
  console.log('error', err);
});

export function allDocs () {
  return db.allDocs({include_docs: true});
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

export function remove (doc) {
  return update(doc, {_deleted: true});
}

// ~~~~~~~~~~~~~~~~~~~ //
// DEFAULT MODEL STUFF //
// ~~~~~~~~~~~~~~~~~~~ //

function modelCreate (type, idPrefix, defaults, patch = {}) {
  const model = Object.assign(
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
  return modelCreate('Request', 'req', {
    url: '',
    name: 'New Request',
    method: methods.METHOD_GET,
    body: '',
    params: [],
    contentType: 'text/plain',
    headers: [],
    authentication: {},
    parent: null
  }, patch);
}

export function requestCopy (originalRequest) {
  const name = `${originalRequest.name} (Copy)`;
  return requestCreate(Object.assign({}, originalRequest, {name}));
}


// ~~~~~~~~~~~~~ //
// REQUEST GROUP //
// ~~~~~~~~~~~~~ //

export function requestGroupCreate (patch = {}) {
  return modelCreate('RequestGroup', 'grp', {
    collapsed: false,
    name: 'New Request Group',
    environment: {},
    parent: null
  }, patch);
}


// ~~~~~~~~~//
// RESPONSE //
// ~~~~~~~~~//

export function responseCreate (patch = {}) {
  return modelCreate('Response', 'rsp', {
    requestId: null,
    statusCode: 0,
    statusMessage: '',
    contentType: 'text/plain',
    bytes: 0,
    millis: 0,
    headers: {},
    body: ''
  }, patch);
}

db.createIndex({
  index: {fields: ['requestId']}
}).catch(err => {
  console.error('Failed to create index', err);
}).then(() => {
  console.log('-- Indexes Updated --');
});

export function responseGetForRequest (request) {
  return db.find({
    selector: {
      requestId: request._id
    },
    sort: [{requestId: 'desc'}],
    limit: 1
  })
}
