/* eslint-disable prefer-rest-params -- don't want to change ...arguments usage for these sensitive functions without more testing */
import electron from 'electron';
import NeDB from 'nedb';
import fsPath from 'path';
import * as uuid from 'uuid';

import { mustGetModel } from '../models';
import { CookieJar } from '../models/cookie-jar';
import { Environment } from '../models/environment';
import { GitRepository } from '../models/git-repository';
import { getMonkeyPatchedControlledSettings } from '../models/helpers/settings';
import type { BaseModel } from '../models/index';
import * as models from '../models/index';
import { isSettings } from '../models/settings';
import type { Workspace } from '../models/workspace';
import { DB_PERSIST_INTERVAL } from './constants';
import { getDataDirectory } from './electron-helpers';
import { generateId } from './misc';

export interface Query {
  _id?: string | SpecificQuery;
  parentId?: string | null;
  remoteId?: string | null;
  plugin?: string;
  key?: string;
  environmentId?: string | null;
  protoFileId?: string;
}

type Sort = Record<string, any>;

interface Operation {
  upsert?: BaseModel[];
  remove?: BaseModel[];
}

export interface SpecificQuery {
  $gt?: number;
  $in?: string[];
  $nin?: string[];
}

export type ModelQuery<T extends BaseModel> = Partial<Record<keyof T, SpecificQuery>>;

export const database = {
  all: async function<T extends BaseModel>(type: string) {
    if (db._empty) return _send<T[]>('all', ...arguments);
    return database.find<T>(type);
  },

  batchModifyDocs: async function({ upsert = [], remove = [] }: Operation) {
    if (db._empty) return _send<void>('batchModifyDocs', ...arguments);
    const flushId = await database.bufferChanges();

    // Perform from least to most dangerous
    await Promise.all(upsert.map(doc => database.upsert(doc, true)));
    await Promise.all(remove.map(doc => database.unsafeRemove(doc, true)));

    await database.flushChanges(flushId);
  },

  /** buffers database changes and returns a buffer id */
  bufferChanges: async function(millis = 1000) {
    if (db._empty) return _send<number>('bufferChanges', ...arguments);
    bufferingChanges = true;
    setTimeout(database.flushChanges, millis);
    return ++bufferChangesId;
  },

  /** buffers database changes and returns a buffer id */
  bufferChangesIndefinitely: async function() {
    if (db._empty) return _send<number>('bufferChangesIndefinitely', ...arguments);
    bufferingChanges = true;
    return ++bufferChangesId;
  },

  CHANGE_INSERT: 'insert',

  CHANGE_UPDATE: 'update',

  CHANGE_REMOVE: 'remove',

  count: async function<T extends BaseModel>(type: string, query: Query = {}) {
    if (db._empty) return _send<number>('count', ...arguments);
    return new Promise<number>((resolve, reject) => {
      (db[type] as NeDB<T>).count(query, (err, count) => {
        if (err) {
          return reject(err);
        }

        resolve(count);
      });
    });
  },

  docCreate: async <T extends BaseModel>(type: string, ...patches: Patch<T>[]) => {
    const doc = await models.initModel<T>(
      type,
      ...patches,
      // Fields that the user can't touch
      {
        type: type,
      },
    );
    return database.insert<T>(doc);
  },

  docUpdate: async <T extends BaseModel>(originalDoc: T, ...patches: Patch<T>[]) => {
    // No need to re-initialize the model during update; originalDoc will be in a valid state by virtue of loading
    const doc = await models.initModel<T>(
      originalDoc.type,
      originalDoc,

      // NOTE: This is before `patches` because we want `patch.modified` to win if it has it
      {
        modified: Date.now(),
      },
      ...patches,
    );
    return database.update<T>(doc);
  },

  duplicate: async function<T extends BaseModel>(originalDoc: T, patch: Patch<T> = {}) {
    if (db._empty) return _send<T>('duplicate', ...arguments);
    const flushId = await database.bufferChanges();

    async function next<T extends BaseModel>(docToCopy: T, patch: Patch<T>) {
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
  },

  find: async function<T extends BaseModel>(
    type: string,
    query: Query | string = {},
    sort: Sort = { created: 1 },
  ) {
    if (db._empty) return _send<T[]>('find', ...arguments);
    return new Promise<T[]>((resolve, reject) => {
      (db[type] as NeDB<T>)
        .find(query)
        .sort(sort)
        .exec(async (err, rawDocs) => {
          if (err) {
            reject(err);
            return;
          }

          const docs: T[] = [];

          for (const rawDoc of rawDocs) {
            docs.push(await models.initModel(type, rawDoc));
          }

          resolve(docs);
        });
    });
  },

  findMostRecentlyModified: async function<T extends BaseModel>(
    type: string,
    query: Query = {},
    limit: number | null = null,
  ) {
    if (db._empty) return _send<T[]>('findMostRecentlyModified', ...arguments);
    return new Promise<T[]>(resolve => {
      (db[type] as NeDB<T>)
        .find(query)
        .sort({
          modified: -1,
        })
        // @ts-expect-error -- TSCONVERSION limit shouldn't be applied if it's null, or default to something that means no-limit
        .limit(limit)
        .exec(async (err, rawDocs) => {
          if (err) {
            console.warn('[db] Failed to find docs', err);
            resolve([]);
            return;
          }

          const docs: T[] = [];

          for (const rawDoc of rawDocs) {
            docs.push(await models.initModel(type, rawDoc));
          }

          resolve(docs);
        });
    });
  },

  flushChanges: async function(id = 0, fake = false) {
    if (db._empty) return _send<void>('flushChanges', ...arguments);

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
  },

  flushChangesAsync: async (fake = false) => {
    process.nextTick(async () => {
      await database.flushChanges(0, fake);
    });
  },

  get: async function<T extends BaseModel>(type: string, id?: string) {
    if (db._empty) return _send<T>('get', ...arguments);

    // Short circuit IDs used to represent nothing
    if (!id || id === 'n/a') {
      return null;
    } else {
      return database.getWhere<T>(type, { _id: id });
    }
  },

  getMostRecentlyModified: async function<T extends BaseModel>(type: string, query: Query = {}) {
    if (db._empty) return _send<T>('getMostRecentlyModified', ...arguments);
    const docs = await database.findMostRecentlyModified<T>(type, query, 1);
    return docs.length ? docs[0] : null;
  },

  getWhere: async function<T extends BaseModel>(type: string, query: ModelQuery<T> | Query) {
    if (db._empty) return _send<T>('getWhere', ...arguments);
    // @ts-expect-error -- TSCONVERSION type narrowing needed
    const docs = await database.find<T>(type, query);
    return docs.length ? docs[0] : null;
  },

  init: async (
    types: string[],
    config: NeDB.DataStoreOptions = {},
    forceReset = false,
    consoleLog: typeof console.log = console.log,
  ) => {
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

    // NOTE: Only repair the DB if we're not running in memory. Repairing here causes tests to hang indefinitely for some reason.
    // TODO: Figure out why this makes tests hang
    if (!config.inMemoryOnly) {
      await _repairDatabase();
      consoleLog(`[db] Initialized DB at ${getDBFilePath('$TYPE')}`);
    }

    // This isn't the best place for this but w/e
    // Listen for response deletions and delete corresponding response body files
    database.onChange(async changes => {
      for (const [type, doc] of changes) {
        // TODO(TSCONVERSION) what's returned here is the entire model implementation, not just a model
        // The type definition will be a little confusing
        const m: Record<string, any> | null = models.getModel(doc.type);

        if (!m) {
          continue;
        }

        if (type === database.CHANGE_REMOVE && typeof m.hookRemove === 'function') {
          try {
            await m.hookRemove(doc, consoleLog);
          } catch (err) {
            consoleLog(`[db] Delete hook failed for ${type} ${doc._id}: ${err.message}`);
          }
        }

        if (type === database.CHANGE_INSERT && typeof m.hookInsert === 'function') {
          try {
            await m.hookInsert(doc, consoleLog);
          } catch (err) {
            consoleLog(`[db] Insert hook failed for ${type} ${doc._id}: ${err.message}`);
          }
        }

        if (type === database.CHANGE_UPDATE && typeof m.hookUpdate === 'function') {
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
  },

  initClient: async () => {
    electron.ipcRenderer.on('db.changes', async (_e, changes) => {
      for (const fn of changeListeners) {
        await fn(changes);
      }
    });
    console.log('[db] Initialized DB client');
  },

  insert: async function<T extends BaseModel>(doc: T, fromSync = false, initializeModel = true) {
    if (db._empty) return _send<T>('insert', ...arguments);
    return new Promise<T>(async (resolve, reject) => {
      let docWithDefaults: T | null = null;

      try {
        if (initializeModel) {
          docWithDefaults = await models.initModel<T>(doc.type, doc);
        } else {
          docWithDefaults = doc;
        }
      } catch (err) {
        return reject(err);
      }

      (db[doc.type] as NeDB<T>).insert(docWithDefaults, (err, newDoc: T) => {
        if (err) {
          return reject(err);
        }

        resolve(newDoc);
        // NOTE: This needs to be after we resolve
        notifyOfChange(database.CHANGE_INSERT, newDoc, fromSync);
      });
    });
  },

  onChange: (callback: ChangeListener) => {
    changeListeners.push(callback);
  },

  offChange: (callback: ChangeListener) => {
    changeListeners = changeListeners.filter(l => l !== callback);
  },

  remove: async function<T extends BaseModel>(doc: T, fromSync = false) {
    if (db._empty) return _send<void>('remove', ...arguments);

    const flushId = await database.bufferChanges();

    const docs = await database.withDescendants(doc);
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

    docs.map(d => notifyOfChange(database.CHANGE_REMOVE, d, fromSync));
    await database.flushChanges(flushId);
  },

  removeWhere: async function<T extends BaseModel>(type: string, query: Query) {
    if (db._empty) return _send<void>('removeWhere', ...arguments);
    const flushId = await database.bufferChanges();

    for (const doc of await database.find<T>(type, query)) {
      const docs = await database.withDescendants(doc);
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
      docs.map(d => notifyOfChange(database.CHANGE_REMOVE, d, false));
    }

    await database.flushChanges(flushId);
  },

  /** Removes entries without removing their children */
  unsafeRemove: async function<T extends BaseModel>(doc: T, fromSync = false) {
    if (db._empty) return _send<void>('unsafeRemove', ...arguments);

    (db[doc.type] as NeDB<T>).remove({ _id: doc._id });
    notifyOfChange(database.CHANGE_REMOVE, doc, fromSync);
  },

  update: async function<T extends BaseModel>(doc: T, fromSync = false) {
    if (db._empty) return _send<T>('update', ...arguments);

    return new Promise<T>(async (resolve, reject) => {
      let docWithDefaults: T;

      try {
        docWithDefaults = await models.initModel<T>(doc.type, doc);
      } catch (err) {
        return reject(err);
      }

      (db[doc.type] as NeDB<T>).update(
        { _id: docWithDefaults._id },
        docWithDefaults,
        // TODO(TSCONVERSION) see comment below, upsert can happen automatically as part of the update
        // @ts-expect-error -- TSCONVERSION expects 4 args but only sent 3. Need to validate what UpdateOptions should be.
        err => {
          if (err) {
            return reject(err);
          }

          resolve(docWithDefaults);
          // NOTE: This needs to be after we resolve
          notifyOfChange(database.CHANGE_UPDATE, docWithDefaults, fromSync);
        },
      );
    });
  },

  // TODO(TSCONVERSION) the update method above can now take an upsert property
  upsert: async function<T extends BaseModel>(doc: T, fromSync = false) {
    if (db._empty) return _send<T>('upsert', ...arguments);
    const existingDoc = await database.get<T>(doc.type, doc._id);

    if (existingDoc) {
      return database.update<T>(doc, fromSync);
    } else {
      return database.insert<T>(doc, fromSync);
    }
  },

  withAncestors: async function<T extends BaseModel>(doc: T | null, types: string[] = allTypes()) {
    if (db._empty) return _send<T[]>('withAncestors', ...arguments);

    if (!doc) {
      return [];
    }

    let docsToReturn: T[] = doc ? [doc] : [];

    async function next(docs: T[]): Promise<T[]> {
      const foundDocs: T[] = [];

      for (const d of docs) {
        for (const type of types) {
          // If the doc is null, we want to search for parentId === null
          const another = await database.get<T>(type, d.parentId);
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
  },

  withDescendants: async function<T extends BaseModel>(doc: T | null, stopType: string | null = null): Promise<BaseModel[]> {
    if (db._empty) return _send<BaseModel[]>('withDescendants', ...arguments);
    let docsToReturn: BaseModel[] = doc ? [doc] : [];

    async function next(docs: (BaseModel | null)[]): Promise<BaseModel[]> {
      let foundDocs: BaseModel[] = [];

      for (const doc of docs) {
        if (stopType && doc && doc.type === stopType) {
          continue;
        }

        const promises: Promise<BaseModel[]>[] = [];

        for (const type of allTypes()) {
          // If the doc is null, we want to search for parentId === null
          const parentId = doc ? doc._id : null;
          const promise = database.find(type, { parentId });
          promises.push(promise);
        }

        for (const more of await Promise.all(promises)) {
          foundDocs = [
            ...foundDocs,
            ...more,
          ];
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
  },
};

interface DB {
  [index: string]: NeDB;
}

// @ts-expect-error -- TSCONVERSION _empty doesn't match the index signature, use something other than _empty in future
const db: DB = {
  _empty: true,
} as DB;

// ~~~~~~~ //
// HELPERS //
// ~~~~~~~ //
const allTypes = () => Object.keys(db);

function getDBFilePath(modelType: string) {
  // NOTE: Do not EVER change this. EVER!
  return fsPath.join(getDataDirectory(), `insomnia.${modelType}.db`);
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

async function notifyOfChange<T extends BaseModel>(event: string, doc: T, fromSync: boolean) {
  let updatedDoc = doc;

  // NOTE: this monkeypatching is temporary, and was determined to have the smallest blast radius if it exists here (rather than, say, a reducer or an action creator).
  // see: INS-1059
  if (isSettings(doc)) {
    updatedDoc = getMonkeyPatchedControlledSettings(doc);
  }

  changeBuffer.push([event, updatedDoc, fromSync]);

  // Flush right away if we're not buffering
  if (!bufferingChanges) {
    await database.flushChanges();
  }
}

// ~~~~~~~~~~~~~~~~~~~ //
// DEFAULT MODEL STUFF //
// ~~~~~~~~~~~~~~~~~~~ //

type Patch<T> = Partial<T>;

// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //
async function _send<T>(fnName: string, ...args: any[]) {
  return new Promise<T>((resolve, reject) => {
    const replyChannel = `db.fn.reply:${uuid.v4()}`;
    electron.ipcRenderer.send('db.fn', fnName, replyChannel, ...args);
    electron.ipcRenderer.once(replyChannel, (_e, err, result: T) => {
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

  for (const workspace of await database.find<Workspace>(models.workspace.type)) {
    await _repairBaseEnvironments(workspace);
    await _fixMultipleCookieJars(workspace);
    await _applyApiSpecName(workspace);
  }

  for (const gitRepository of await database.find<GitRepository>(models.gitRepository.type)) {
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
async function _repairBaseEnvironments(workspace: Workspace) {
  const baseEnvironments = await database.find<Environment>(models.environment.type, {
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
    const subEnvironments = await database.find<Environment>(models.environment.type, {
      parentId: baseEnvironment._id,
    });

    for (const subEnvironment of subEnvironments) {
      await database.docUpdate(subEnvironment, {
        parentId: chosenBase._id,
      });
    }

    // Remove unnecessary base env
    await database.remove(baseEnvironment);
  }

  // Update remaining base env
  await database.update(chosenBase);
  console.log(`[fix] Merged ${baseEnvironments.length} base environments under ${workspace.name}`);
}

/**
 * This function repairs workspaces that have multiple cookie jars. Since a workspace
 * can only have one, this function walks over all jars and merges them and their cookies
 * together.
 */
async function _fixMultipleCookieJars(workspace: Workspace) {
  const cookieJars = await database.find<CookieJar>(models.cookieJar.type, {
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
    await database.remove(cookieJar);
  }

  // Update remaining jar
  await database.update(chosenJar);
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
  await database.update(doc);
  console.log(`[fix] Fixed git URI for ${doc._id}`);
}
