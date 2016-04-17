import PouchDB from 'pouchdb';
import * as methods from '../constants/global';
import {generateId} from './util'

let db = new PouchDB('insomnia.db');

global.db = db;

let changes = db.changes({
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

// ~~~~~~~ //
// REQUEST //
// ~~~~~~~ //

export function requestCreate (patch = {}) {
  const request = Object.assign(
    // Defaults
    {
      url: '',
      name: 'New Request',
      method: methods.METHOD_GET,
      body: '',
      params: [],
      contentType: 'text/plain',
      headers: [],
      authentication: {},
      parent: null
    },

    // Initial Fields
    patch,

    // Required Generated Fields
    {
      _id: generateId('req'),
      _rev: undefined,
      type: 'Request',
      created: Date.now(),
      modified: Date.now()
    }
  );
  
  update(request);
  
  return request;
}

export function requestDuplicate (request) {
  return requestCreate(request);
}

// ~~~~~~~~~~~~~ //
// REQUEST GROUP //
// ~~~~~~~~~~~~~ //

export function requestGroupCreate (patch = {}) {
  const requestGroup = Object.assign(
    // Default Fields
    {
      collapsed: false,
      name: 'New Request Group',
      environment: {},
      parent: null
    },

    // Initial Fields
    patch,

    // Required Generated Fields
    {
      _id: generateId('grp'),
      _rev: undefined,
      type: 'RequestGroup',
      created: Date.now(),
      modified: Date.now()
    }
  );
  
  update(requestGroup);
  
  return requestGroup;
}

export {changes};
