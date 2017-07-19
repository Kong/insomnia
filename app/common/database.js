// @flow
import type {BaseModel} from '../models/index';
import electron from 'electron';
import NeDB from 'nedb';
import fs from 'fs';
import fsPath from 'path';
import {DB_PERSIST_INTERVAL} from './constants';
import {initModel} from '../models';
import * as models from '../models/index';
import AlertModal from '../ui/components/modals/alert-modal';
import {showModal} from '../ui/components/modals/index';
import {trackEvent} from '../analytics/index';

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
export function init (types: Array<string>, config: Object = {}, forceReset: boolean = false) {
  if (forceReset) {
    changeListeners = [];
    db = {};
  }

  // Fill in the defaults
  for (const modelType of types) {
    if (db[modelType]) {
      console.warn(`[db] Already initialized DB.${modelType}`);
      continue;
    }

    const filePath = getDBFilePath(modelType);

    // Check to make sure the responses DB file isn't too big to parse. If it is, we
    // should delete it
    try {
      const MBs = fs.statSync(filePath).size / 1024 / 1024;
      if (modelType === models.response.type && MBs > 256) {
        // NOTE: Node.js can't have a string longer than 256MB. Since the response DB can reach
        // sizes that big, let's not even load it if it's bigger than that. Just start over.
        console.warn(`[db] Response DB too big (${MBs}). Deleting...`);
        fs.unlinkSync(filePath);

        // Can't show alert until the app renders, so delay for a bit first
        setTimeout(() => {
          showModal(AlertModal, {
            title: 'Response DB Too Large',
            message: 'Your combined responses have exceeded 256MB and have been flushed. ' +
            'NOTE: A better solution to this will be implemented in a future release.'
          });
          trackEvent('Alert', 'DB Too Large');
        }, 1000);
      }
    } catch (err) {
      // File probably did not exist probably, so no big deal
    }

    const collection = new NeDB(Object.assign({
      autoload: true,
      filename: filePath
    }, config));

    collection.persistence.setAutocompactionInterval(DB_PERSIST_INTERVAL);

    db[modelType] = collection;
  }

  console.log(`[db] Initialized DB at ${getDBFilePath('$TYPE')}`);
}

// ~~~~~~~~~~~~~~~~ //
// Change Listeners //
// ~~~~~~~~~~~~~~~~ //

let bufferingChanges = false;
let changeBuffer = [];
let changeListeners = [];

export function onChange (callback: Function): void {
  changeListeners.push(callback);
}

export function offChange (callback: Function): void {
  changeListeners = changeListeners.filter(l => l !== callback);
}

export function bufferChanges (millis: number = 1000): void {
  bufferingChanges = true;
  setTimeout(flushChanges, millis);
}

export async function flushChanges (): Promise<void> {
  bufferingChanges = false;
  const changes = [...changeBuffer];
  changeBuffer = [];

  if (changes.length === 0) {
    // No work to do
    return;
  }

  for (const fn of changeListeners) {
    await fn(changes);
  }
}

async function notifyOfChange (event: string, doc: BaseModel, fromSync: boolean): Promise<void> {
  changeBuffer.push([event, doc, fromSync]);

  // Flush right away if we're not buffering
  if (!bufferingChanges) {
    await flushChanges();
  }
}

// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //

export async function getMostRecentlyModified (
  type: string,
  query: Object = {}
): Promise<BaseModel | null> {
  const docs = await findMostRecentlyModified(type, query, 1);
  return docs.length ? docs[0] : null;
}

export function findMostRecentlyModified (
  type: string,
  query: Object = {},
  limit: number | null = null
): Promise<Array<BaseModel>> {
  return new Promise(resolve => {
    db[type].find(query).sort({modified: -1}).limit(limit).exec((err, rawDocs) => {
      if (err) {
        console.warn('[db] Failed to find docs', err);
        resolve([]);
        return;
      }

      const docs = rawDocs.map(rawDoc => {
        return initModel(type, rawDoc);
      });

      resolve(docs);
    });
  });
}

export function find<T: BaseModel> (
  type: string,
  query: Object = {},
  sort: Object = {created: 1}
): Promise<Array<T>> {
  return new Promise((resolve, reject) => {
    db[type].find(query).sort(sort).exec((err, rawDocs) => {
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

export function all <T: BaseModel> (type: string): Promise<Array<T>> {
  return find(type);
}

export async function getWhere<T: BaseModel> (type: string, query: Object): Promise<T | null> {
  const docs = await find(type, query);
  return docs.length ? docs[0] : null;
}

export async function get<T: BaseModel> (type: string, id: string): Promise<T | null> {
  // Short circuit IDs used to represent nothing
  if (!id || id === 'n/a') {
    return null;
  } else {
    return getWhere(type, {_id: id});
  }
}

export function count (type: string, query: Object = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    db[type].count(query, (err, count) => {
      if (err) {
        return reject(err);
      }

      resolve(count);
    });
  });
}

export async function upsert (doc: BaseModel, fromSync: boolean = false): Promise<BaseModel> {
  const existingDoc = await get(doc.type, doc._id);
  if (existingDoc) {
    return update(doc, fromSync);
  } else {
    return insert(doc, fromSync);
  }
}

export function insert<T: BaseModel> (doc: T, fromSync: boolean = false): Promise<T> {
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

export function update <T: BaseModel> (doc: T, fromSync: boolean = false): Promise<T> {
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

export async function remove <T: BaseModel> (doc: T, fromSync: boolean = false): Promise<void> {
  bufferChanges();

  const docs = await withDescendants(doc);
  const docIds = docs.map(d => d._id);
  const types = [...new Set(docs.map(d => d.type))];

  // Don't really need to wait for this to be over;
  types.map(t => db[t].remove({_id: {$in: docIds}}, {multi: true}));

  docs.map(d => notifyOfChange(CHANGE_REMOVE, d, fromSync));

  flushChanges();
}

export async function removeWhere (type: string, query: Object): Promise<void> {
  bufferChanges();

  for (const doc of await find(type, query)) {
    const docs = await withDescendants(doc);
    const docIds = docs.map(d => d._id);
    const types = [...new Set(docs.map(d => d.type))];

    // Don't really need to wait for this to be over;
    types.map(t => db[t].remove({_id: {$in: docIds}}, {multi: true}));

    docs.map(d => notifyOfChange(CHANGE_REMOVE, d, false));
  }

  flushChanges();
}

// ~~~~~~~~~~~~~~~~~~~ //
// DEFAULT MODEL STUFF //
// ~~~~~~~~~~~~~~~~~~~ //

export function docUpdate <T: BaseModel> (originalDoc: T, patch: Object = {}): Promise<T> {
  const doc = initModel(
    originalDoc.type,
    originalDoc,
    patch,
    {modified: Date.now()},
  );

  return update(doc);
}

export function docCreate<T: BaseModel> (type: string, ...patches: Array<Object>): Promise<T> {
  const doc = initModel(
    type,
    ...patches,

    // Fields that the user can't touch
    {
      type: type,
      modified: Date.now()
    }
  );

  return insert(doc);
}

// ~~~~~~~ //
// GENERAL //
// ~~~~~~~ //

export async function withDescendants (
  doc: BaseModel,
  stopType: string | null = null
): Promise<Array<BaseModel>> {
  let docsToReturn = doc ? [doc] : [];

  async function next (docs: Array<BaseModel>): Promise<Array<BaseModel>> {
    let foundDocs = [];

    for (const d of docs) {
      if (stopType && d.type === stopType) {
        continue;
      }

      for (const type of allTypes()) {
        // If the doc is null, we want to search for parentId === null
        const parentId = d ? d._id : null;
        const more = await find(type, {parentId});
        foundDocs = [...foundDocs, ...more];
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

export async function withAncestors (
  doc: BaseModel | null,
  types: Array<string> = allTypes()
): Promise<Array<BaseModel>> {
  if (!doc) {
    return [];
  }

  let docsToReturn = doc ? [doc] : [];

  async function next (docs: Array<BaseModel>): Promise<Array<BaseModel>> {
    let foundDocs = [];
    for (const d: BaseModel of docs) {
      for (const type of types) {
        // If the doc is null, we want to search for parentId === null
        const another = await get(type, d.parentId);
        another && foundDocs.push(another);
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

export async function duplicate <T: BaseModel> (originalDoc: T, patch: Object = {}): Promise<T> {
  bufferChanges();

  async function next <T: BaseModel> (docToCopy: T, patch: Object): Promise<T> {
    // 1. Copy the doc
    const newDoc = Object.assign({}, docToCopy, patch);
    delete newDoc._id;
    delete newDoc.created;
    delete newDoc.modified;

    const createdDoc = await docCreate(newDoc.type, newDoc);

    // 2. Get all the children
    for (const type of allTypes()) {
      // Note: We never want to duplicate a response
      if (!models.canDuplicate(type)) {
        continue;
      }

      const parentId = docToCopy._id;
      const children = await find(type, {parentId});
      for (const doc of children) {
        await next(doc, {parentId: createdDoc._id});
      }
    }

    return createdDoc;
  }

  const createdDoc = await next(originalDoc, patch);

  flushChanges();

  return createdDoc;
}
