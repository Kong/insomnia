import electron from 'electron';
import NeDB from 'nedb';
import fsPath from 'path';
import {DB_PERSIST_INTERVAL} from './constants';
import {generateId} from './misc';
import {getModel, initModel} from '../models';
import * as models from '../models/index';

export const CHANGE_INSERT = 'insert';
export const CHANGE_UPDATE = 'update';
export const CHANGE_REMOVE = 'remove';

let db = {};

// ~~~~~~~ //
// HELPERS //
// ~~~~~~~ //

function allTypes () {
  return Object.keys(db);
}

function getDBFilePath (modelType) {
  // NOTE: Do not EVER change this. EVER!
  const basePath = electron.remote.app.getPath('userData');
  return fsPath.join(basePath, `insomnia.${modelType}.db`);
}

/**
 * Initialize the database. Note that this isn't actually async, but might be
 * in the future!
 *
 * @param types
 * @param config
 * @param forceReset
 * @returns {null}
 */
export async function init (types, config = {}, forceReset = false) {
  if (forceReset) {
    db = {};
  }

  // Fill in the defaults
  for (const modelType of types) {
    if (db[modelType]) {
      console.warn(`-- Already initialized DB.${modelType} --`);
      continue;
    }

    const filePath = getDBFilePath(modelType);

    db[modelType] = new NeDB(Object.assign({
      filename: filePath,
      autoload: true
    }, config));

    db[modelType].persistence.setAutocompactionInterval(DB_PERSIST_INTERVAL);

  }

  console.log(`-- Initialized DB at ${getDBFilePath('$TYPE')} --`);
}


// ~~~~~~~~~~~~~~~~ //
// Change Listeners //
// ~~~~~~~~~~~~~~~~ //

let bufferingChanges = false;
let changeBuffer = [];
let changeListeners = [];

export function onChange (callback) {
  console.log(`-- Added DB Listener -- `);
  changeListeners.push(callback);
}

export function offChange (callback) {
  console.log(`-- Removed DB Listener -- `);
  changeListeners = changeListeners.filter(l => l !== callback);
}

export function bufferChanges (millis = 1000) {
  bufferingChanges = true;
  setTimeout(flushChanges, millis);
}

export function flushChanges () {
  bufferingChanges = false;
  const changes = [...changeBuffer];
  changeBuffer = [];

  if (changes.length === 0) {
    // No work to do
    return;
  }

  changeListeners.map(fn => fn(changes));
}

function notifyOfChange (event, doc, fromSync) {
  changeBuffer.push([event, doc, fromSync]);

  // Flush right away if we're not buffering
  if (!bufferingChanges) {
    flushChanges();
  }
}


// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //

export async function getMostRecentlyModified (type, query = {}) {
  const docs = await findMostRecentlyModified(type, query, 1);
  return docs.length ? docs[0] : null;
}

export function findMostRecentlyModified (type, query = {}, limit = null) {
  return new Promise(resolve => {
    db[type].find(query).sort({modified: -1}).limit(limit).exec((err, docs) => {
      resolve(docs);
    })
  })
}

export function find (type, query = {}) {
  return new Promise((resolve, reject) => {
    db[type].find(query, (err, rawDocs) => {
      if (err) {
        return reject(err);
      }

      const docs = rawDocs.map(rawDoc => {
        return initModel(type, rawDoc);
      });

      resolve(docs);
    });
  });
}

export function all (type) {
  return find(type);
}

export function getWhere (type, query) {
  return new Promise((resolve, reject) => {
    db[type].find(query, (err, rawDocs) => {
      if (err) {
        return reject(err);
      }

      if (rawDocs.length === 0) {
        // Not found. Too bad!
        return resolve(null);
      }

      resolve(initModel(type, rawDocs[0]));
    })
  })
}

export function get (type, id) {
  return getWhere(type, {_id: id});
}

export function count (type, query = {}) {
  return new Promise((resolve, reject) => {
    db[type].count(query, (err, count) => {
      if (err) {
        return reject(err);
      }

      resolve(count);
    });
  });
}

export async function upsert (doc, fromSync = false) {
  const existingDoc = await get(doc.type, doc._id);
  if (existingDoc) {
    return update(doc, fromSync);
  } else {
    return insert(doc, fromSync);
  }
}

export function insert (doc, fromSync = false) {
  return new Promise((resolve, reject) => {
    const docWithDefaults = initModel(doc.type, doc);
    db[doc.type].insert(docWithDefaults, (err, newDoc) => {
      if (err) {
        return reject(err);
      }

      notifyOfChange(CHANGE_INSERT, newDoc, fromSync);
      resolve(newDoc);
    });
  });
}

export function update (doc, fromSync = false) {
  return new Promise((resolve, reject) => {
    const docWithDefaults = initModel(doc.type, doc);
    db[doc.type].update({_id: docWithDefaults._id}, docWithDefaults, err => {
      if (err) {
        return reject(err);
      }

      notifyOfChange(CHANGE_UPDATE, docWithDefaults, fromSync);

      resolve(docWithDefaults);
    });
  });
}

export async function remove (doc, fromSync = false) {
  bufferChanges();

  const docs = await withDescendants(doc);
  const docIds = docs.map(d => d._id);
  const types = [...new Set(docs.map(d => d.type))];

  // Don't really need to wait for this to be over;
  types.map(t => db[t].remove({_id: {$in: docIds}}, {multi: true}));

  docs.map(d => notifyOfChange(CHANGE_REMOVE, d, fromSync));

  flushChanges();
}

/**
 * Remove a lot of documents quickly and silently
 *
 * @param type
 * @param query
 * @returns {Promise.<T>}
 */
export function removeBulkSilently (type, query) {
  return new Promise(resolve => {
    db[type].remove(query, {multi: true}, err => resolve());
  });
}


// ~~~~~~~~~~~~~~~~~~~ //
// DEFAULT MODEL STUFF //
// ~~~~~~~~~~~~~~~~~~~ //

export function docUpdate (originalDoc, patch = {}) {
  const doc = initModel(
    originalDoc.type,
    originalDoc,
    patch,
    {modified: Date.now()},
  );

  return update(doc);
}

export function docCreate (type, patch = {}) {
  const idPrefix = getModel(type).prefix;

  if (!idPrefix) {
    throw new Error(`No ID prefix for ${type}`)
  }

  const doc = initModel(
    type,
    patch,

    // Fields that the user can't touch
    {
      type: type,
      modified: Date.now(),
    }
  );

  // NOTE: This CAN'T be inside initModel() because initModel checks
  // for _id existence to do migrations and stuff
  if (!doc._id) {
    doc._id = generateId(idPrefix);
  }

  return insert(doc);
}

// ~~~~~~~ //
// GENERAL //
// ~~~~~~~ //

export async function withDescendants (doc = null) {
  let docsToReturn = doc ? [doc] : [];

  async function next (docs) {
    let foundDocs = [];

    for (const d of docs) {
      for (const type of allTypes()) {
        // If the doc is null, we want to search for parentId === null
        const parentId = d ? d._id : null;
        const more = await find(type, {parentId});
        foundDocs = [...foundDocs, ...more]
      }
    }

    if (foundDocs.length === 0) {
      // Didn't find anything. We're done
      return docsToReturn;
    }

    // Continue searching for children
    docsToReturn = [...docsToReturn, ...foundDocs];
    return await next(foundDocs);
  }

  return await next([doc]);
}

export async function withAncestors (doc) {
  let docsToReturn = doc ? [doc] : [];

  async function next (docs) {
    let foundDocs = [];

    for (const d of docs) {
      for (const type of allTypes()) {
        // If the doc is null, we want to search for parentId === null
        const more = await find(type, {_id: d.parentId});
        foundDocs = [...foundDocs, ...more]
      }
    }

    if (foundDocs.length === 0) {
      // Didn't find anything. We're done
      return docsToReturn;
    }

    // Continue searching for children
    docsToReturn = [...docsToReturn, ...foundDocs];
    return await next(foundDocs);
  }

  return await next([doc]);
}

export async function duplicate (originalDoc, patch = {}, first = true) {
  bufferChanges();

  // 1. Copy the doc
  const newDoc = Object.assign({}, originalDoc, patch);
  delete newDoc._id;
  delete newDoc.created;
  delete newDoc.modified;

  const createdDoc = await docCreate(newDoc.type, newDoc);

  // 2. Get all the children
  for (const type of allTypes()) {
    // Note: We never want to duplicate a response
    if (type === models.response.type) {
      continue;
    }

    const parentId = originalDoc._id;
    const children = await find(type, {parentId});
    for (const doc of children) {
      await duplicate(doc, {parentId: createdDoc._id}, false)
    }
  }

  if (first) {
    flushChanges();
  }

  return createdDoc;
}
