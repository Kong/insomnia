// @flow
import type { BaseModel } from '../models/index';
import * as models from '../models/index';
import electron from 'electron';
import NeDB from 'nedb';
import fsPath from 'path';
import { DB_PERSIST_INTERVAL } from './constants';
import * as uuid from 'uuid';
import { generateId, getDataDirectory } from './misc';
import { mustGetModel } from '../models';
import type { Workspace } from '../models/workspace';

export const CHANGE_INSERT = 'insert';
export const CHANGE_UPDATE = 'update';
export const CHANGE_REMOVE = 'remove';

const database = {};
const db = ({
  _empty: true,
}: Object);

// ~~~~~~~ //
// HELPERS //
// ~~~~~~~ //

function allTypes() {
  return Object.keys(db);
}

function getDBFilePath(modelType) {
  // NOTE: Do not EVER change this. EVER!
  return fsPath.join(getDataDirectory(), `insomnia.${modelType}.db`);
}

export async function initClient() {
  electron.ipcRenderer.on('db.changes', async (e, changes) => {
    for (const fn of changeListeners) {
      await fn(changes);
    }
  });
  console.log('[db] Initialized DB client');
}

export async function init(
  types: Array<string>,
  config: Object = {},
  forceReset: boolean = false,
  consoleLog: () => void = console.log,
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
      consoleLog(`[db] Already initialized DB.${modelType}`);
      continue;
    }

    const filePath = getDBFilePath(modelType);
    const collection = new NeDB(
      Object.assign(
        {
          autoload: true,
          filename: filePath,
          corruptAlertThreshold: 0.9,
        },
        config,
      ),
    );

    collection.persistence.setAutocompactionInterval(DB_PERSIST_INTERVAL);

    db[modelType] = collection;
  }

  delete db._empty;

  electron.ipcMain.on('db.fn', async (e, fnName, replyChannel, ...args) => {
    try {
      const result = await database[fnName](...args);
      e.sender.send(replyChannel, null, result);
    } catch (err) {
      e.sender.send(replyChannel, { message: err.message, stack: err.stack });
    }
  });

  // NOTE: Only repair the DB if we're not running in memory. Repairing here causes tests to
  // hang indefinitely for some reason.
  // TODO: Figure out why this makes tests hang
  if (!config.inMemoryOnly) {
    await _repairDatabase();
  }

  if (!config.inMemoryOnly) {
    consoleLog(`[db] Initialized DB at ${getDBFilePath('$TYPE')}`);
  }

  // This isn't the best place for this but w/e
  // Listen for response deletions and delete corresponding response body files
  onChange(async changes => {
    for (const [type, doc] of changes) {
      const m: Object | null = models.getModel(doc.type);

      if (!m) {
        continue;
      }

      if (type === CHANGE_REMOVE && typeof m.hookRemove === 'function') {
        try {
          await m.hookRemove(doc, consoleLog);
        } catch (err) {
          consoleLog(`[db] Delete hook failed for ${type} ${doc._id}: ${err.message}`);
        }
      }

      if (type === CHANGE_INSERT && typeof m.hookInsert === 'function') {
        try {
          await m.hookInsert(doc, consoleLog);
        } catch (err) {
          consoleLog(`[db] Insert hook failed for ${type} ${doc._id}: ${err.message}`);
        }
      }

      if (type === CHANGE_UPDATE && typeof m.hookUpdate === 'function') {
        try {
          await m.hookUpdate(doc, consoleLog);
        } catch (err) {
          consoleLog(`[db] Update hook failed for ${type} ${doc._id}: ${err.message}`);
        }
      }
    }
  });

  for (const model of models.all()) {
    if (typeof model.hookDatabaseInit === 'function') {
      await model.hookDatabaseInit(consoleLog);
    }
  }
}

// ~~~~~~~~~~~~~~~~ //
// Change Listeners //
// ~~~~~~~~~~~~~~~~ //

let bufferingChanges = false;
let bufferChangesId = 1;
let changeBuffer = [];
let changeListeners = [];

export function onChange(callback: Function): void {
  changeListeners.push(callback);
}

export function offChange(callback: Function): void {
  changeListeners = changeListeners.filter(l => l !== callback);
}

/** buffers database changes and returns false if was already buffering */
export const bufferChanges = (database.bufferChanges = async function(
  millis: number = 1000,
): Promise<number> {
  if (db._empty) return _send('bufferChanges', ...arguments);

  bufferingChanges = true;
  setTimeout(database.flushChanges, millis);

  return ++bufferChangesId;
});

export const flushChangesAsync = (database.flushChangesAsync = async function(
  fake: boolean = false,
) {
  process.nextTick(async () => {
    await flushChanges(0, fake);
  });
});

export const flushChanges = (database.flushChanges = async function(
  id: number = 0,
  fake: boolean = false,
) {
  if (db._empty) return _send('flushChanges', ...arguments);

  // Only flush if ID is 0 or the current flush ID is the same as passed
  if (id !== 0 && bufferChangesId !== id) {
    return;
  }

  bufferingChanges = false;
  const changes = [...changeBuffer];
  changeBuffer = [];

  if (changes.length === 0) {
    // No work to do
    return;
  }

  if (fake) {
    console.log(`[db] Dropped ${changes.length} changes.`);
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
});

async function notifyOfChange(event: string, doc: BaseModel, fromSync: boolean): Promise<void> {
  changeBuffer.push([event, doc, fromSync]);

  // Flush right away if we're not buffering
  if (!bufferingChanges) {
    await database.flushChanges();
  }
}

// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //

export const getMostRecentlyModified = (database.getMostRecentlyModified = async function<T>(
  type: string,
  query: Object = {},
): Promise<T | null> {
  if (db._empty) return _send('getMostRecentlyModified', ...arguments);

  const docs = await database.findMostRecentlyModified(type, query, 1);
  return docs.length ? docs[0] : null;
});

export const findMostRecentlyModified = (database.findMostRecentlyModified = async function<T>(
  type: string,
  query: Object = {},
  limit: number | null = null,
): Promise<Array<T>> {
  if (db._empty) return _send('findMostRecentlyModified', ...arguments);

  return new Promise(resolve => {
    db[type]
      .find(query)
      .sort({ modified: -1 })
      .limit(limit)
      .exec(async (err, rawDocs) => {
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
});

export const find = (database.find = async function<T: BaseModel>(
  type: string,
  query: Object = {},
  sort: Object = { created: 1 },
): Promise<Array<T>> {
  if (db._empty) return _send('find', ...arguments);

  return new Promise((resolve, reject) => {
    db[type]
      .find(query)
      .sort(sort)
      .exec(async (err, rawDocs) => {
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
});

export const all = (database.all = async function<T: BaseModel>(type: string): Promise<Array<T>> {
  if (db._empty) return _send('all', ...arguments);

  return database.find(type);
});

export const getWhere = (database.getWhere = async function<T: BaseModel>(
  type: string,
  query: Object,
): Promise<T | null> {
  if (db._empty) return _send('getWhere', ...arguments);

  const docs = await database.find(type, query);
  return docs.length ? docs[0] : null;
});

export const get = (database.get = async function<T: BaseModel>(
  type: string,
  id: string,
): Promise<T | null> {
  if (db._empty) return _send('get', ...arguments);

  // Short circuit IDs used to represent nothing
  if (!id || id === 'n/a') {
    return null;
  } else {
    return database.getWhere(type, { _id: id });
  }
});

export const count = (database.count = async function(
  type: string,
  query: Object = {},
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
});

export const upsert = (database.upsert = async function(
  doc: BaseModel,
  fromSync: boolean = false,
): Promise<BaseModel> {
  if (db._empty) return _send('upsert', ...arguments);

  const existingDoc = await database.get(doc.type, doc._id);
  if (existingDoc) {
    return database.update(doc, fromSync);
  } else {
    return database.insert(doc, fromSync);
  }
});

export const insert = (database.insert = async function<T: BaseModel>(
  doc: T,
  fromSync: boolean = false,
  initializeModel: boolean = true,
): Promise<T> {
  if (db._empty) return _send('insert', ...arguments);

  return new Promise(async (resolve, reject) => {
    let docWithDefaults;
    try {
      if (initializeModel) {
        docWithDefaults = await models.initModel(doc.type, doc);
      } else {
        docWithDefaults = doc;
      }
    } catch (err) {
      return reject(err);
    }

    db[doc.type].insert(docWithDefaults, (err, newDoc) => {
      if (err) {
        return reject(err);
      }

      resolve(newDoc);

      // NOTE: This needs to be after we resolve
      notifyOfChange(CHANGE_INSERT, newDoc, fromSync);
    });
  });
});

export const update = (database.update = async function<T: BaseModel>(
  doc: T,
  fromSync: boolean = false,
): Promise<T> {
  if (db._empty) return _send('update', ...arguments);

  return new Promise(async (resolve, reject) => {
    let docWithDefaults;
    try {
      docWithDefaults = await models.initModel(doc.type, doc);
    } catch (err) {
      return reject(err);
    }

    db[doc.type].update({ _id: docWithDefaults._id }, docWithDefaults, err => {
      if (err) {
        return reject(err);
      }

      resolve(docWithDefaults);

      // NOTE: This needs to be after we resolve
      notifyOfChange(CHANGE_UPDATE, docWithDefaults, fromSync);
    });
  });
});

export const remove = (database.remove = async function<T: BaseModel>(
  doc: T,
  fromSync: boolean = false,
): Promise<void> {
  if (db._empty) return _send('remove', ...arguments);

  const flushId = await database.bufferChanges();

  const docs = await database.withDescendants(doc);
  const docIds = docs.map(d => d._id);
  const types = [...new Set(docs.map(d => d.type))];

  // Don't really need to wait for this to be over;
  types.map(t => db[t].remove({ _id: { $in: docIds } }, { multi: true }));

  docs.map(d => notifyOfChange(CHANGE_REMOVE, d, fromSync));

  await database.flushChanges(flushId);
});

/** Removes entries without removing their children */
export const unsafeRemove = (database.unsafeRemove = async function<T: BaseModel>(
  doc: T,
  fromSync: boolean = false,
): Promise<void> {
  if (db._empty) return _send('unsafeRemove', ...arguments);

  db[doc.type].remove({ _id: doc._id });
  notifyOfChange(CHANGE_REMOVE, doc, fromSync);
});

export const removeWhere = (database.removeWhere = async function(
  type: string,
  query: Object,
): Promise<void> {
  if (db._empty) return _send('removeWhere', ...arguments);

  const flushId = await database.bufferChanges();

  for (const doc of await database.find(type, query)) {
    const docs = await database.withDescendants(doc);
    const docIds = docs.map(d => d._id);
    const types = [...new Set(docs.map(d => d.type))];

    // Don't really need to wait for this to be over;
    types.map(t => db[t].remove({ _id: { $in: docIds } }, { multi: true }));

    docs.map(d => notifyOfChange(CHANGE_REMOVE, d, false));
  }

  await database.flushChanges(flushId);
});

export const batchModifyDocs = (database.batchModifyDocs = async function(operations: {
  upsert: Array<Object>,
  remove: Array<Object>,
}): Promise<void> {
  if (db._empty) return _send('batchModifyDocs', ...arguments);

  const flushId = await bufferChanges();

  const promisesUpserted = [];
  const promisesDeleted = [];
  for (const doc: BaseModel of operations.upsert) {
    promisesUpserted.push(upsert(doc, true));
  }

  for (const doc: BaseModel of operations.remove) {
    promisesDeleted.push(unsafeRemove(doc, true));
  }

  // Perform from least to most dangerous
  await Promise.all(promisesUpserted);
  await Promise.all(promisesDeleted);

  await flushChanges(flushId);
});

// ~~~~~~~~~~~~~~~~~~~ //
// DEFAULT MODEL STUFF //
// ~~~~~~~~~~~~~~~~~~~ //

export async function docUpdate<T: BaseModel>(
  originalDoc: T,
  ...patches: Array<Object>
): Promise<T> {
  // No need to re-initialize the model during update; originalDoc will be in a valid state by virtue of loading
  const doc = await models.initModel(
    originalDoc.type,
    originalDoc,

    // NOTE: This is before `patch` because we want `patch.modified` to win if it has it
    { modified: Date.now() },

    ...patches,
  );

  return database.update(doc);
}

export async function docCreate<T: BaseModel>(type: string, ...patches: Array<Object>): Promise<T> {
  const doc = await models.initModel(
    type,
    ...patches,

    // Fields that the user can't touch
    { type: type },
  );

  return database.insert(doc);
}

// ~~~~~~~ //
// GENERAL //
// ~~~~~~~ //

export const withDescendants = (database.withDescendants = async function(
  doc: BaseModel | null,
  stopType: string | null = null,
): Promise<Array<BaseModel>> {
  if (db._empty) return _send('withDescendants', ...arguments);

  let docsToReturn = doc ? [doc] : [];

  async function next(docs: Array<BaseModel | null>): Promise<Array<BaseModel>> {
    let foundDocs = [];

    for (const d of docs) {
      if (stopType && d && d.type === stopType) {
        continue;
      }

      const promises = [];
      for (const type of allTypes()) {
        // If the doc is null, we want to search for parentId === null
        const parentId = d ? d._id : null;
        promises.push(database.find(type, { parentId }));
      }

      for (const more of await Promise.all(promises)) {
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
});

export const withAncestors = (database.withAncestors = async function(
  doc: BaseModel | null,
  types: Array<string> = allTypes(),
): Promise<Array<BaseModel>> {
  if (db._empty) return _send('withAncestors', ...arguments);

  if (!doc) {
    return [];
  }

  let docsToReturn = doc ? [doc] : [];

  async function next(docs: Array<BaseModel>): Promise<Array<BaseModel>> {
    const foundDocs = [];
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
});

export const duplicate = (database.duplicate = async function<T: BaseModel>(
  originalDoc: T,
  patch: Object = {},
): Promise<T> {
  if (db._empty) return _send('duplicate', ...arguments);

  const flushId = await database.bufferChanges();

  async function next<T: BaseModel>(docToCopy: T, patch: Object): Promise<T> {
    const model = mustGetModel(docToCopy.type);

    const overrides = {
      _id: generateId(model.prefix),
      modified: Date.now(),
      created: Date.now(),
      type: docToCopy.type, // Ensure this is not overwritten by the patch
    };

    // 1. Copy the doc
    const newDoc = Object.assign({}, docToCopy, patch, overrides);

    // Don't initialize the model during insert, and simply duplicate
    const createdDoc = await database.insert(newDoc, false, false);

    // 2. Get all the children
    for (const type of allTypes()) {
      // Note: We never want to duplicate a response
      if (!models.canDuplicate(type)) {
        continue;
      }

      const parentId = docToCopy._id;
      const children = await database.find(type, { parentId });
      for (const doc of children) {
        await next(doc, { parentId: createdDoc._id });
      }
    }

    return createdDoc;
  }

  const createdDoc = await next(originalDoc, patch);

  await database.flushChanges(flushId);

  return createdDoc;
});

// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //

async function _send<T>(fnName: string, ...args: Array<any>): Promise<T> {
  return new Promise((resolve, reject) => {
    const replyChannel = `db.fn.reply:${uuid.v4()}`;
    electron.ipcRenderer.send('db.fn', fnName, replyChannel, ...args);
    electron.ipcRenderer.once(replyChannel, (e, err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Run various database repair scripts
 */
export async function _repairDatabase() {
  console.log('[fix] Running database repairs');
  for (const workspace of await find(models.workspace.type)) {
    await _repairBaseEnvironments(workspace);
    await _fixMultipleCookieJars(workspace);
    await _applyApiSpecName(workspace);
  }
}

/**
 * This function ensures that apiSpec exists for each workspace
 * If the filename on the apiSpec is not set or is the default initialized name
 * It will apply the workspace name to it
 */
async function _applyApiSpecName(workspace: Workspace) {
  const apiSpec = await models.apiSpec.getByParentId(workspace._id);

  if (!apiSpec.fileName || apiSpec.fileName === models.apiSpec.init().fileName) {
    await models.apiSpec.update(apiSpec, { fileName: workspace.name });
  }
}

/**
 * This function repairs workspaces that have multiple base environments. Since a workspace
 * can only have one, this function walks over all base environments, merges the data, and
 * moves all children as well.
 */
async function _repairBaseEnvironments(workspace) {
  const baseEnvironments = await find(models.environment.type, {
    parentId: workspace._id,
  });

  // Nothing to do here
  if (baseEnvironments.length <= 1) {
    return;
  }

  const chosenBase = baseEnvironments[0];
  for (const baseEnvironment of baseEnvironments) {
    if (baseEnvironment._id === chosenBase._id) {
      continue;
    }

    chosenBase.data = Object.assign(baseEnvironment.data, chosenBase.data);
    const subEnvironments = await find(models.environment.type, {
      parentId: baseEnvironment._id,
    });

    for (const subEnvironment of subEnvironments) {
      await docUpdate(subEnvironment, { parentId: chosenBase._id });
    }

    // Remove unnecessary base env
    await remove(baseEnvironment);
  }

  // Update remaining base env
  await update(chosenBase);

  console.log(`[fix] Merged ${baseEnvironments.length} base environments under ${workspace.name}`);
}

/**
 * This function repairs workspaces that have multiple cookie jars. Since a workspace
 * can only have one, this function walks over all jars and merges them and their cookies
 * together.
 */
async function _fixMultipleCookieJars(workspace) {
  const cookieJars = await find(models.cookieJar.type, {
    parentId: workspace._id,
  });

  // Nothing to do here
  if (cookieJars.length <= 1) {
    return;
  }

  const chosenJar = cookieJars[0];
  for (const cookieJar of cookieJars) {
    if (cookieJar._id === chosenJar._id) {
      continue;
    }

    for (const cookie of cookieJar.cookies) {
      if (chosenJar.cookies.find(c => c.id === cookie.id)) {
        continue;
      }

      chosenJar.cookies.push(cookie);
    }

    // Remove unnecessary jar
    await remove(cookieJar);
  }

  // Update remaining jar
  await update(chosenJar);

  console.log(`[fix] Merged ${cookieJars.length} cookie jars under ${workspace.name}`);
}
