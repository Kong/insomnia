// @flow
import type {BaseModel} from '../models/index';
import * as models from '../models/index';
import electron from 'electron';
import NeDB from 'nedb';
import fsPath from 'path';
import {DB_PERSIST_INTERVAL} from './constants';
import uuid from 'uuid';

export const CHANGE_INSERT = 'insert';
export const CHANGE_UPDATE = 'update';
export const CHANGE_REMOVE = 'remove';

const database = {};
const db = {
  _empty: true
};

// ~~~~~~~ //
// HELPERS //
// ~~~~~~~ //

function allTypes () {
  return Object.keys(db);
}

function getDBFilePath (modelType) {
  // NOTE: Do not EVER change this. EVER!
  const {app} = electron.remote || electron;
  const basePath = app.getPath('userData');
  return fsPath.join(basePath, `insomnia.${modelType}.db`);
}

export async function initClient () {
  electron.ipcRenderer.on('db.changes', async (e, changes) => {
    for (const fn of changeListeners) {
      await fn(changes);
    }
  });
  console.log('[db] Initialized DB client');
}

export async function init (
  types: Array<string>,
  config: Object = {},
  forceReset: boolean = false
) {
  if (forceReset) {
    changeListeners = [];
    for (const attr of Object.keys(db)) {
      if (attr === '_empty') {
        continue;
      }

      delete db[attr];
    }
  }

  // Fill in the defaults
  for (const modelType of types) {
    if (db[modelType]) {
      console.warn(`[db] Already initialized DB.${modelType}`);
      continue;
    }

    const filePath = getDBFilePath(modelType);
    const collection = new NeDB(Object.assign({
      autoload: true,
      filename: filePath
    }, config));

    collection.persistence.setAutocompactionInterval(DB_PERSIST_INTERVAL);

    db[modelType] = collection;
  }

  delete db._empty;

  electron.ipcMain.on('db.fn', async (e, fnName, replyChannel, ...args) => {
    const result = await database[fnName](...args);
    e.sender.send(replyChannel, result);
  });

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

export const bufferChanges = database.bufferChanges = function (millis: number = 1000): void {
  if (db._empty) {
    _send('bufferChanges', ...arguments);
    return;
  }

  bufferingChanges = true;
  setTimeout(database.flushChanges, millis);
};

export const flushChanges = database.flushChanges = async function (): Promise<void> {
  if (db._empty) return _send('flushChanges', ...arguments);

  bufferingChanges = false;
  const changes = [...changeBuffer];
  changeBuffer = [];

  if (changes.length === 0) {
    // No work to do
    return;
  }

  // Notify local listeners too
  for (const fn of changeListeners) {
    await fn(changes);
  }

  // Notify remote listeners
  const windows = electron.BrowserWindow.getAllWindows();
  for (const window of windows) {
    window.webContents.send('db.changes', changes);
  }
};

async function notifyOfChange (event: string, doc: BaseModel, fromSync: boolean): Promise<void> {
  changeBuffer.push([event, doc, fromSync]);

  // Flush right away if we're not buffering
  if (!bufferingChanges) {
    await database.flushChanges();
  }
}

// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //

export const getMostRecentlyModified = database.getMostRecentlyModified = async function (
  type: string,
  query: Object = {}
): Promise<BaseModel | null> {
  if (db._empty) return _send('getMostRecentlyModified', ...arguments);

  const docs = await database.findMostRecentlyModified(type, query, 1);
  return docs.length ? docs[0] : null;
};

export const findMostRecentlyModified = database.findMostRecentlyModified = async function (
  type: string,
  query: Object = {},
  limit: number | null = null
): Promise<Array<BaseModel>> {
  if (db._empty) return _send('findMostRecentlyModified', ...arguments);

  return new Promise(resolve => {
    db[type].find(query).sort({modified: -1}).limit(limit).exec(async (err, rawDocs) => {
      if (err) {
        console.warn('[db] Failed to find docs', err);
        resolve([]);
        return;
      }

      const docs = [];
      for (const rawDoc of rawDocs) {
        docs.push(await models.initModel(type, rawDoc));
      }

      resolve(docs);
    });
  });
};

export const find = database.find = async function <T: BaseModel> (
  type: string,
  query: Object = {},
  sort: Object = {created: 1}
): Promise<Array<T>> {
  if (db._empty) return _send('find', ...arguments);

  return new Promise((resolve, reject) => {
    db[type].find(query).sort(sort).exec(async (err, rawDocs) => {
      if (err) {
        return reject(err);
      }

      const docs = [];
      for (const rawDoc of rawDocs) {
        docs.push(await models.initModel(type, rawDoc));
      }

      resolve(docs);
    });
  });
};

export const all = database.all = async function <T: BaseModel> (type: string): Promise<Array<T>> {
  if (db._empty) return _send('all', ...arguments);

  return database.find(type);
};

export const getWhere = database.getWhere = async function <T: BaseModel> (
  type: string,
  query: Object
): Promise<T | null> {
  if (db._empty) return _send('getWhere', ...arguments);

  const docs = await database.find(type, query);
  return docs.length ? docs[0] : null;
};

export const get = database.get = async function <T: BaseModel> (
  type: string,
  id: string
): Promise<T | null> {
  if (db._empty) return _send('get', ...arguments);

  // Short circuit IDs used to represent nothing
  if (!id || id === 'n/a') {
    return null;
  } else {
    return database.getWhere(type, {_id: id});
  }
};

export const count = database.count = async function (
  type: string,
  query: Object = {}
): Promise<number> {
  if (db._empty) return _send('count', ...arguments);

  return new Promise((resolve, reject) => {
    db[type].count(query, (err, count) => {
      if (err) {
        return reject(err);
      }

      resolve(count);
    });
  });
};

export const upsert = database.upsert = async function (
  doc: BaseModel,
  fromSync: boolean = false
): Promise<BaseModel> {
  if (db._empty) return _send('upsert', ...arguments);

  const existingDoc = await database.get(doc.type, doc._id);
  if (existingDoc) {
    return database.update(doc, fromSync);
  } else {
    return database.insert(doc, fromSync);
  }
};

export const insert = database.insert = async function <T: BaseModel> (
  doc: T,
  fromSync: boolean = false
): Promise<T> {
  if (db._empty) return _send('insert', ...arguments);

  return new Promise(async (resolve, reject) => {
    const docWithDefaults = await models.initModel(doc.type, doc);
    db[doc.type].insert(docWithDefaults, (err, newDoc) => {
      if (err) {
        return reject(err);
      }

      resolve(newDoc);

      // NOTE: This needs to be after we resolve
      notifyOfChange(CHANGE_INSERT, newDoc, fromSync);
    });
  });
};

export const update = database.update = async function <T: BaseModel> (
  doc: T,
  fromSync: boolean = false
): Promise<T> {
  if (db._empty) return _send('update', ...arguments);

  return new Promise(async (resolve, reject) => {
    const docWithDefaults = await models.initModel(doc.type, doc);
    db[doc.type].update({_id: docWithDefaults._id}, docWithDefaults, err => {
      if (err) {
        return reject(err);
      }

      resolve(docWithDefaults);

      // NOTE: This needs to be after we resolve
      notifyOfChange(CHANGE_UPDATE, docWithDefaults, fromSync);
    });
  });
};

export const remove = database.remove = async function <T: BaseModel> (
  doc: T,
  fromSync: boolean = false
): Promise<void> {
  if (db._empty) return _send('remove', ...arguments);

  database.bufferChanges();

  const docs = await database.withDescendants(doc);
  const docIds = docs.map(d => d._id);
  const types = [...new Set(docs.map(d => d.type))];

  // Don't really need to wait for this to be over;
  types.map(t => db[t].remove({_id: {$in: docIds}}, {multi: true}));

  docs.map(d => notifyOfChange(CHANGE_REMOVE, d, fromSync));

  database.flushChanges();
};

export const removeWhere = database.removeWhere = async function (
  type: string,
  query: Object
): Promise<void> {
  if (db._empty) return _send('removeWhere', ...arguments);

  database.bufferChanges();

  for (const doc of await database.find(type, query)) {
    const docs = await database.withDescendants(doc);
    const docIds = docs.map(d => d._id);
    const types = [...new Set(docs.map(d => d.type))];

    // Don't really need to wait for this to be over;
    types.map(t => db[t].remove({_id: {$in: docIds}}, {multi: true}));

    docs.map(d => notifyOfChange(CHANGE_REMOVE, d, false));
  }

  database.flushChanges();
};

// ~~~~~~~~~~~~~~~~~~~ //
// DEFAULT MODEL STUFF //
// ~~~~~~~~~~~~~~~~~~~ //

export async function docUpdate<T: BaseModel> (originalDoc: T, patch: Object = {}): Promise<T> {
  const doc = await models.initModel(
    originalDoc.type,
    originalDoc,

    // NOTE: This is before `patch` because we want `patch.modified` to win if it has it
    {modified: Date.now()},

    patch
  );

  return database.update(doc);
}

export async function docCreateNoMigrate<T: BaseModel> (
  type: string,
  ...patches: Array<Object>
): Promise<T> {
  const doc = await models.initModel(
    type,
    ...patches,

    // Fields that the user can't touch
    {type: type},
    {__NO_MIGRATE: true}
  );

  return database.insert(doc);
}

export async function docCreate<T: BaseModel> (
  type: string,
  ...patches: Array<Object>
): Promise<T> {
  const doc = await models.initModel(
    type,
    ...patches,

    // Fields that the user can't touch
    {type: type}
  );

  return database.insert(doc);
}

// ~~~~~~~ //
// GENERAL //
// ~~~~~~~ //

export const withDescendants = database.withDescendants = async function <T: BaseModel> (
  doc: T,
  stopType: string | null = null
): Promise<Array<T>> {
  if (db._empty) return _send('withDescendants', ...arguments);

  let docsToReturn = doc ? [doc] : [];

  async function next (docs: Array<BaseModel>) {
    let foundDocs = [];

    for (const d of docs) {
      if (stopType && d.type === stopType) {
        continue;
      }

      for (const type of allTypes()) {
        // If the doc is null, we want to search for parentId === null
        const parentId = d ? d._id : null;
        const more = await database.find(type, {parentId});
        foundDocs = [...foundDocs, ...more];
      }
    }

    if (foundDocs.length === 0) {
      // Didn't find anything. We're done
      return docsToReturn;
    }

    // Continue searching for children
    docsToReturn = [...docsToReturn, ...foundDocs];
    return next(foundDocs);
  }

  return next([doc]);
};

export const withAncestors = database.withAncestors = async function (
  doc: BaseModel | null,
  types: Array<string> = allTypes()
): Promise<Array<BaseModel>> {
  if (db._empty) return _send('withAncestors', ...arguments);

  if (!doc) {
    return [];
  }

  let docsToReturn = doc ? [doc] : [];

  async function next (docs: Array<BaseModel>): Promise<Array<BaseModel>> {
    let foundDocs = [];
    for (const d: BaseModel of docs) {
      for (const type of types) {
        // If the doc is null, we want to search for parentId === null
        const another = await database.get(type, d.parentId);
        another && foundDocs.push(another);
      }
    }

    if (foundDocs.length === 0) {
      // Didn't find anything. We're done
      return docsToReturn;
    }

    // Continue searching for children
    docsToReturn = [...docsToReturn, ...foundDocs];
    return next(foundDocs);
  }

  return next([doc]);
};

export const duplicate = database.duplicate = async function <T: BaseModel> (
  originalDoc: T,
  patch: Object = {}
): Promise<T> {
  if (db._empty) return _send('duplicate', ...arguments);

  database.bufferChanges();

  async function next<T: BaseModel> (docToCopy: T, patch: Object): Promise<T> {
    // 1. Copy the doc
    const newDoc = Object.assign({}, docToCopy, patch);
    delete newDoc._id;
    delete newDoc.created;
    delete newDoc.modified;

    const createdDoc = await docCreateNoMigrate(newDoc.type, newDoc);

    // 2. Get all the children
    for (const type of allTypes()) {
      // Note: We never want to duplicate a response
      if (!models.canDuplicate(type)) {
        continue;
      }

      const parentId = docToCopy._id;
      const children = await database.find(type, {parentId});
      for (const doc of children) {
        await next(doc, {parentId: createdDoc._id});
      }
    }

    return createdDoc;
  }

  const createdDoc = await next(originalDoc, patch);

  database.flushChanges();

  return createdDoc;
};

// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //

async function _send<T> (fnName: string, ...args: Array<any>): Promise<T> {
  return new Promise((resolve, reject) => {
    const replyChannel = `db.fn.reply:${uuid.v4()}`;
    electron.ipcRenderer.send('db.fn', fnName, replyChannel, ...args);
    electron.ipcRenderer.once(replyChannel, (e, result) => {
      resolve(result);
    });
  });
}
