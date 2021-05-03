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
import { GitRepository } from '../models/git-repository';

export const CHANGE_INSERT = 'insert';

export const CHANGE_UPDATE = 'update';

export const CHANGE_REMOVE = 'remove';

export interface Query {
  _id?: string | SpecificQuery;
  parentId?: string;
  plugin?: string;
  key?: string;
  environmentId?: string | null;
}

type Sort = Record<string, any>;

interface Operation {
  upsert: Record<string, any>;
  remove: Record<string, any>;
}

export interface SpecificQuery {
  $gt?: number;
  $nin?: string[];
}

export type ModelQuery<T extends BaseModel> = Partial<Record<keyof T, SpecificQuery>> &;

interface Database {
  bufferChanges: (milliseconds?: number) => Promise<number>;
  bufferChangesIndefinitely: () => Promise<number>;
  flushChangesAsync: (fake?: boolean) => Promise<void>;
  flushChanges: (id?: number, fake?: boolean) => Promise<number | undefined | void>;
  getMostRecentlyModified: <T>(type: string, query?: Query) => Promise<T | null>;
  findMostRecentlyModified: <T>(type: string, query?: Query, limit?: number | null) => Promise<T[]>;
  find: <T extends BaseModel>(type: string, query?: ModelQuery<T>, sort?: Sort) => Promise<T[]>;
  all: <T extends BaseModel>(type: string) => Promise<T[] | undefined>;
  getWhere: <T extends BaseModel>(type: string, query: ModelQuery<T>) => Promise<T | null>;
  get: <T extends BaseModel>(type: string, id?: string) => Promise<T | null>;
  count: (type: string, query?: Query) => Promise<number>;
  upsert: <T extends BaseModel>(doc: T, fromSync?: boolean) => Promise<T>;
  insert: <T extends BaseModel>(doc: T, fromSync?: boolean, initializeModel?: boolean) => Promise<T>;
  update: <T extends BaseModel>(doc: T, fromSync?: boolean) => Promise<T>;
  remove: <T extends BaseModel>(doc: T, fromSync?: boolean) => Promise<void>;
  unsafeRemove: <T extends BaseModel>(doc: T, fromSync?: boolean) => Promise<void>;
  removeWhere: (type: string, query: Query) => Promise<void>;
  batchModifyDocs: (operation: Operation) => Promise<void>;
  withDescendants: <T extends BaseModel>(doc: T | null, stopType?: string | null) => Promise<T[]>;
  withAncestors: <T extends BaseModel>(doc: T | null, types?: string[]) => Promise<T[]>;
  duplicate: <T extends BaseModel>(originalDoc: T, patch?: Patch) => Promise<T>;
}

// NOTE TO OPENDER: if we can avoid doing the module assignment for all of the below we can clear all of these errors but I wasn't totally sure there wasn't some arcane yet valid reason we are doing this so I left it alone. please share your opinion.
const database: Database = {
  // @ts-expect-error TSCONVERSION
  all,
  // @ts-expect-error TSCONVERSION
  batchModifyDocs,
  // @ts-expect-error TSCONVERSION
  bufferChanges,
  // @ts-expect-error TSCONVERSION
  bufferChangesIndefinitely,
  // @ts-expect-error TSCONVERSION
  count,
  // @ts-expect-error TSCONVERSION
  duplicate,
  // @ts-expect-error TSCONVERSION
  find,
  // @ts-expect-error TSCONVERSION
  findMostRecentlyModified,
  // @ts-expect-error TSCONVERSION
  flushChanges,
  // @ts-expect-error TSCONVERSION
  flushChangesAsync,
  // @ts-expect-error TSCONVERSION
  get,
  // @ts-expect-error TSCONVERSION
  getMostRecentlyModified,
  // @ts-expect-error TSCONVERSION
  getWhere,
  // @ts-expect-error TSCONVERSION
  insert,
  // @ts-expect-error TSCONVERSION
  remove,
  // @ts-expect-error TSCONVERSION
  removeWhere,
  // @ts-expect-error TSCONVERSION
  unsafeRemove,
  // @ts-expect-error TSCONVERSION
  update,
  // @ts-expect-error TSCONVERSION
  upsert,
  // @ts-expect-error TSCONVERSION
  withAncestors,
  // @ts-expect-error TSCONVERSION
  withDescendants,
};

const db: {
  _empty?: boolean;
} = {
  _empty: true,
};

// ~~~~~~~ //
// HELPERS //
// ~~~~~~~ //
const allTypes = () => Object.keys(db);

function getDBFilePath(modelType) {
  // NOTE: Do not EVER change this. EVER!
  return fsPath.join(getDataDirectory(), `insomnia.${modelType}.db`);
}

export async function initClient() {
  electron.ipcRenderer.on('db.changes', async (_e, changes) => {
    for (const fn of changeListeners) {
      await fn(changes);
    }
  });
  console.log('[db] Initialized DB client');
}

export async function init(
  types: string[],
  config: Record<string, any> = {},
  forceReset = false,
  consoleLog: typeof console.log = console.log,
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
      e.sender.send(replyChannel, {
        message: err.message,
        stack: err.stack,
      });
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
      const m: Record<string, any> | null = models.getModel(doc.type);

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
    // @ts-expect-error -- TSCONVERSION optional type on response
    if (typeof model.hookDatabaseInit === 'function') {
      // @ts-expect-error -- TSCONVERSION optional type on response
      await model.hookDatabaseInit?.(consoleLog);
    }
  }
}

// ~~~~~~~~~~~~~~~~ //
// Change Listeners //
// ~~~~~~~~~~~~~~~~ //
let bufferingChanges = false;
let bufferChangesId = 1;

type ChangeBufferEvent = [
  event: string,
  doc: BaseModel,
  fromSync: boolean
];

let changeBuffer: ChangeBufferEvent[] = [];

type ChangeListener = Function;

let changeListeners: ChangeListener[] = [];

export function onChange(callback: (...args: any[]) => any) {
  changeListeners.push(callback);
}

export function offChange(callback: (...args: any[]) => any) {
  changeListeners = changeListeners.filter(l => l !== callback);
}

/** buffers database changes and returns a buffer id */
export const bufferChanges: Database['bufferChanges'] = (database.bufferChanges = async function(millis = 1000) {
  if (db._empty) return _send('bufferChanges', ...arguments);
  bufferingChanges = true;
  setTimeout(timeout => { database.flushChanges?.(timeout); }, millis);
  return ++bufferChangesId;
});

/** buffers database changes and returns a buffer id */
export const bufferChangesIndefinitely: Database['bufferChangesIndefinitely'] = (database.bufferChangesIndefinitely = async function() {
  if (db._empty) return _send('bufferChangesIndefinitely', ...arguments);
  bufferingChanges = true;
  return ++bufferChangesId;
});

export const flushChangesAsync: Database['flushChangesAsync'] = (database.flushChangesAsync = async function(fake = false) {
  process.nextTick(async () => {
    await flushChanges?.(0, fake);
  });
});

export const flushChanges: Database['flushChanges'] = (database.flushChanges = async function(id = 0, fake = false) {
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

async function notifyOfChange(event: string, doc: BaseModel, fromSync: boolean) {
  changeBuffer.push([event, doc, fromSync]);

  // Flush right away if we're not buffering
  if (!bufferingChanges) {
    await database.flushChanges?.();
  }
}

// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //
export const getMostRecentlyModified: Database['getMostRecentlyModified'] = (database.getMostRecentlyModified = async function<T>(type, query = {}) {
  if (db._empty) return _send('getMostRecentlyModified', ...arguments);
  const docs = await database.findMostRecentlyModified?.<T>(type, query, 1);
  return docs?.length ? docs[0] : null;
});

export const findMostRecentlyModified: Database['findMostRecentlyModified'] = (database.findMostRecentlyModified = async function(type, query = {}, limit = null) {
  if (db._empty) return _send('findMostRecentlyModified', ...arguments);
  return new Promise(resolve => {
    db[type]
      .find(query)
      .sort({
        modified: -1,
      })
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

export const find: Database['find'] = (database.find = async function(type, query = {}, sort = { created: 1 }) {
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

export const all: Database['all'] = (database.all = async function(type) {
  if (db._empty) return _send('all', ...arguments);
  return database.find?.(type);
});

export const getWhere: Database['getWhere'] = (database.getWhere = async function(type, query) {
  if (db._empty) return _send('getWhere', ...arguments);
  const docs = await database.find?.(type, query);
  return docs?.length ? docs[0] : null;
});

export const get: Database['get'] = (database.get = async function(type, id?) {
  if (db._empty) return _send('get', ...arguments);

  // Short circuit IDs used to represent nothing
  if (!id || id === 'n/a') {
    return null;
  } else {
    return database.getWhere?.(type, { _id: id });
  }
});

export const count: Database['count'] = (database.count = async function(type, query = {}) {
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

export const upsert: Database['upsert'] = (database.upsert = async function(doc, fromSync = false) {
  if (db._empty) return _send('upsert', ...arguments);
  const existingDoc = await database.get?.(doc.type, doc._id);

  if (existingDoc) {
    return database.update?.(doc, fromSync);
  } else {
    return database.insert?.(doc, fromSync);
  }
});

export const insert: Database['insert'] = (database.insert = async function(doc, fromSync = false, initializeModel = true) {
  if (db._empty) return _send('insert', ...arguments);
  return new Promise(async (resolve, reject) => {
    let docWithDefaults: BaseModel | null = null;

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

export const update: Database['update'] = (database.update = async function(doc, fromSync = false) {
  if (db._empty) return _send('update', ...arguments);
  return new Promise(async (resolve, reject) => {
    let docWithDefaults;

    try {
      docWithDefaults = await models.initModel(doc.type, doc);
    } catch (err) {
      return reject(err);
    }

    db[doc.type].update(
      {
        _id: docWithDefaults._id,
      },
      docWithDefaults,
      err => {
        if (err) {
          return reject(err);
        }

        resolve(docWithDefaults);
        // NOTE: This needs to be after we resolve
        notifyOfChange(CHANGE_UPDATE, docWithDefaults, fromSync);
      },
    );
  });
});

export const remove: Database['remove'] = (database.remove = async function(doc, fromSync = false) {
  if (db._empty) return _send('remove', ...arguments);
  const flushId = await database.bufferChanges?.();
  const docs = await database.withDescendants?.(doc);
  const docIds = docs?.map(d => d._id);
  const types = [...new Set(docs?.map(d => d.type))];
  // Don't really need to wait for this to be over;
  types.map(t =>
    db[t].remove(
      {
        _id: {
          $in: docIds,
        },
      },
      {
        multi: true,
      },
    ),
  );
  docs?.map(d => notifyOfChange(CHANGE_REMOVE, d, fromSync));
  await database.flushChanges?.(flushId);
});

/** Removes entries without removing their children */
export const unsafeRemove: Database['unsafeRemove'] = (database.unsafeRemove = async function(doc, fromSync = false) {
  if (db._empty) return _send('unsafeRemove', ...arguments);
  db[doc.type].remove({
    _id: doc._id,
  });
  notifyOfChange(CHANGE_REMOVE, doc, fromSync);
});

export const removeWhere: Database['removeWhere'] = (database.removeWhere = async function(type, query) {
  if (db._empty) return _send('removeWhere', ...arguments);
  const flushId = await database.bufferChanges?.();

  for (const doc of (await database.find?.(type, query) || [])) {
    const docs = await database.withDescendants?.(doc);
    const docIds = docs.map(d => d._id);
    const types = [...new Set(docs.map(d => d.type))];
    // Don't really need to wait for this to be over;
    types.map(t =>
      db[t].remove(
        {
          _id: {
            $in: docIds,
          },
        },
        {
          multi: true,
        },
      ),
    );
    docs.map(d => notifyOfChange(CHANGE_REMOVE, d, false));
  }

  await database.flushChanges?.(flushId);
});

export const batchModifyDocs: Database['batchModifyDocs'] = (database.batchModifyDocs = async function(operation) {
  if (db._empty) return _send('batchModifyDocs', ...arguments);
  const flushId = await bufferChanges();
  const promisesUpserted: Promise<any>[] = [];
  const promisesDeleted: Promise<any>[] = [];

  // @ts-expect-error -- need real type for Operation properties
  for (const doc of operation.upsert) {
    promisesUpserted.push(upsert(doc, true));
  }

  // @ts-expect-error -- need real type for Operation properties
  for (const doc of operation.remove) {
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
type Patch = Record<string, any>;

export async function docUpdate<T extends BaseModel>(originalDoc: T, ...patches: Patch[]) {
  // No need to re-initialize the model during update; originalDoc will be in a valid state by virtue of loading
  const doc = await models.initModel(
    originalDoc.type,
    originalDoc, // NOTE: This is before `patch` because we want `patch.modified` to win if it has it
    {
      modified: Date.now(),
    },
    ...patches,
  );
  return database.update?.<T>(doc);
}

export async function docCreate<T extends BaseModel>(type: string, ...patches: Patch[]) {
  const doc = await models.initModel(
    type,
    ...patches, // Fields that the user can't touch
    {
      type: type,
    },
  );
  return database.insert?.<T>(doc);
}

// ~~~~~~~ //
// GENERAL //
// ~~~~~~~ //
export const withDescendants: Database['withDescendants'] = (database.withDescendants = async function(doc, stopType = null) {
  if (db._empty) return _send('withDescendants', ...arguments);
  let docsToReturn = doc ? [doc] : [];

  async function next(docs: (BaseModel | null)[]): Promise<BaseModel[]> {
    let foundDocs = [];

    for (const d of docs) {
      if (stopType && d && d.type === stopType) {
        continue;
      }

      const promises = [];

      for (const type of allTypes()) {
        // If the doc is null, we want to search for parentId === null
        const parentId = d ? d._id : null;
        promises.push(database.find?.(type, { parentId }));
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

export const withAncestors: Database['withAncestors'] = (database.withAncestors = async function(doc, types = allTypes()) {
  if (db._empty) return _send('withAncestors', ...arguments);

  if (!doc) {
    return [];
  }

  let docsToReturn: (BaseModel | null)[] = doc ? [doc] : [];

  async function next<T extends BaseModel>(docs: T[]) {
    const foundDocs: T[] = [];

    for (const d of docs) {
      for (const type of types) {
        // If the doc is null, we want to search for parentId === null
        const another = await database.get?.<T>(type, d.parentId);
        another && foundDocs.push(another);
      }
    }

    if (foundDocs.length === 0) {
      // Didn't find anything. We're done
      return docsToReturn;
    }

    // Continue searching for children
    docsToReturn = [
      ...docsToReturn,
      ...foundDocs,
    ];
    return next(foundDocs);
  }

  return next([doc]);
});

export const duplicate: Database['duplicate'] = (database.duplicate = async function(originalDoc, patch = {}) {
  if (db._empty) return _send('duplicate', ...arguments);
  const flushId = await database.bufferChanges?.();

  async function next<T extends BaseModel>(docToCopy: T, patch: Patch) {
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
    const createdDoc = await database.insert?.(newDoc, false, false) as T;

    // 2. Get all the children
    for (const type of allTypes()) {
      // Note: We never want to duplicate a response
      if (!models.canDuplicate(type)) {
        continue;
      }

      const parentId = docToCopy._id;
      const children = await database.find?.(type, { parentId });

      for (const doc of children || []) {
        await next(doc, { parentId: createdDoc._id });
      }
    }

    return createdDoc;
  }

  const createdDoc = await next(originalDoc, patch);
  await database.flushChanges?.(flushId);
  return createdDoc;
});

// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //
async function _send<T>(fnName: string, ...args: any[]) {
  return new Promise<T>((resolve, reject) => {
    const replyChannel = `db.fn.reply:${uuid.v4()}`;
    electron.ipcRenderer.send('db.fn', fnName, replyChannel, ...args);
    electron.ipcRenderer.once(replyChannel, (_e, err, result) => {
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

  for (const gitRepository of await find(models.gitRepository.type)) {
    await _fixOldGitURIs(gitRepository);
  }
}

/**
 * This function ensures that apiSpec exists for each workspace
 * If the filename on the apiSpec is not set or is the default initialized name
 * It will apply the workspace name to it
 */
async function _applyApiSpecName(workspace: Workspace) {
  const apiSpec = await models.apiSpec.getByParentId(workspace._id);
  if (apiSpec === null) {
    return;
  }

  if (!apiSpec.fileName || apiSpec.fileName === models.apiSpec.init().fileName) {
    await models.apiSpec.update(apiSpec, {
      fileName: workspace.name,
    });
  }
}

/**
 * This function repairs workspaces that have multiple base environments. Since a workspace
 * can only have one, this function walks over all base environments, merges the data, and
 * moves all children as well.
 */
async function _repairBaseEnvironments<T extends BaseModel>(workspace: T) {
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
      await docUpdate(subEnvironment, {
        parentId: chosenBase._id,
      });
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

// Append .git to old git URIs to mimic previous isomorphic-git behaviour
async function _fixOldGitURIs(doc: GitRepository) {
  if (!doc.uriNeedsMigration) {
    return;
  }

  if (!doc.uri.endsWith('.git')) {
    doc.uri += '.git';
  }

  doc.uriNeedsMigration = false;
  await update(doc);
  console.log(`[fix] Fixed git URI for ${doc._id}`);
}
