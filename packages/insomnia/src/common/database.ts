// This file could be imported by both main and renderer processes, so it should be written in a way that works in both contexts.

/* eslint-disable prefer-rest-params -- don't want to change ...arguments usage for these sensitive functions without more testing */
import fsPath from 'node:path';

import NeDB from '@seald-io/nedb';
import electron from 'electron';
import { v4 as uuidv4 } from 'uuid';

import type { ApiSpec } from '~/models/api-spec';
import type { CaCertificate } from '~/models/ca-certificate';
import type { ClientCertificate } from '~/models/client-certificate';
import type { CloudProviderCredential } from '~/models/cloud-credential';
import type { WorkspaceMeta } from '~/models/workspace-meta';

import { mustGetModel } from '../models';
import type { CookieJar } from '../models/cookie-jar';
import { type Environment } from '../models/environment';
import type { GitRepository } from '../models/git-repository';
import type { AllTypes, BaseModel } from '../models/index';
import * as models from '../models/index';
import type { Workspace } from '../models/workspace';
import { generateId } from './misc';

export interface Operation {
  upsert?: BaseModel[];
  remove?: BaseModel[];
}

export interface SpecificQuery {
  $gt?: number;
  $in?: (string | null)[];
  $nin?: string[];
  $ne?: string | null;
}

export type Query<T extends BaseModel = BaseModel> = {
  [key in keyof T]?: string | SpecificQuery | null | undefined;
};

export type ChangeType = 'insert' | 'update' | 'remove';
export const database = {
  batchModifyDocs: async function ({ upsert = [], remove = [] }: Operation) {
    if (process.type === 'renderer') {
      return _send<void>('batchModifyDocs', ...arguments);
    }
    const flushId = await database.bufferChanges();

    // Perform from least to most dangerous
    await Promise.all(upsert.map(doc => database.update(doc)));
    await Promise.all(remove.map(doc => database.unsafeRemove(doc)));

    await database.flushChanges(flushId);
  },

  /** buffers database changes and returns a buffer id, automatically call flushChanges in millis,
   * bufferChanges and flushChanges should be called in pair every time documents changes are made to trigger change listeners */
  bufferChanges: async function (millis = 1000) {
    if (process.type === 'renderer') {
      return _send<number>('bufferChanges', ...arguments);
    }
    bufferingChanges = true;
    setTimeout(database.flushChanges, millis);
    return ++bufferChangesId;
  },

  /** buffers database changes and returns a buffer id */
  bufferChangesIndefinitely: async function () {
    if (process.type === 'renderer') {
      return _send<number>('bufferChangesIndefinitely', ...arguments);
    }
    bufferingChanges = true;
    return ++bufferChangesId;
  },

  /** return count num of documents matching query */
  count: async function <T extends BaseModel>(type: AllTypes, query: Query<T> = {}) {
    if (process.type === 'renderer') {
      return _send<number>('count', ...arguments);
    }
    return nedbBucket[type].countAsync(query);
  },

  docCreate: async <T extends BaseModel>(type: AllTypes, ...patches: Partial<T>[]) => {
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

  docUpdate: async <T extends BaseModel>(originalDoc: T, ...patches: Partial<T>[]) => {
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
    return database.update<T>(doc, patches);
  },

  /** duplicate doc and its descendents recursively */
  duplicate: async function <T extends BaseModel>(originalDoc: T, patch: Partial<T> = {}) {
    if (process.type === 'renderer') {
      return _send<T>('duplicate', ...arguments);
    }
    const flushId = await database.bufferChanges();

    async function next<T extends BaseModel>(docToCopy: T, patch: Partial<T>) {
      const model = mustGetModel(docToCopy.type);
      const overrides = {
        _id: generateId(model.prefix),
        modified: Date.now(),
        created: Date.now(),
        type: docToCopy.type, // Ensure this is not overwritten by the patch
      };

      // 1. Copy the doc
      const newDoc = { ...docToCopy, ...patch, ...overrides };

      const createdDoc = await nedbBucket[docToCopy.type].insertAsync(newDoc);
      // 2. Get all the children
      for (const type of Object.keys(nedbBucket) as AllTypes[]) {
        // Note: We never want to duplicate a response
        if (!models.canDuplicate(type)) {
          continue;
        }

        for (const doc of await database.find(type, { parentId: docToCopy._id })) {
          await next(doc, { parentId: createdDoc._id });
        }
      }

      return createdDoc;
    }

    const createdDoc = await next(originalDoc, patch);
    await database.flushChanges(flushId);
    return createdDoc;
  },
  findOne: async function <T extends BaseModel>(
    type: AllTypes,
    query: Query<T> | string = {},
    sort: Record<string, any> = { created: 1 },
  ): Promise<T | undefined> {
    if (process.type === 'renderer') {
      return _send<T>('findOne', ...arguments);
    }
    const doc = await nedbBucket[type].findOneAsync<T>(query).sort(sort);
    if (doc === null) {
      return undefined;
    }
    return models.initModel<T>(type, doc);
  },
  /** find documents matching query */
  find: async function <T extends BaseModel>(
    type: AllTypes,
    query: Query<T> | string = {},
    sort: Record<string, any> = { created: 1 },
    limit = 0,
  ): Promise<T[]> {
    if (process.type === 'renderer') {
      return _send<T[]>('find', ...arguments);
    }
    if (!nedbBucket[type]) {
      console.warn(`[db] No collection for type "${type}"`);
      return [];
    }
    const docs = await nedbBucket[type].findAsync<T>(query).sort(sort).limit(limit);
    // TODO: create a db init phase for migrations rather than doing it on every find.
    const migrated = [];
    for (const rawDoc of docs) {
      migrated.push(await models.initModel<T>(type, rawDoc));
    }
    return migrated;
  },

  /** trigger all changeListeners */
  flushChanges: async function (id = 0, fake = false) {
    if (process.type === 'renderer') {
      return _send<void>('flushChanges', ...arguments);
    }

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
    const isMainContext = process.type === 'browser';
    if (isMainContext) {
      const windows = electron.BrowserWindow.getAllWindows();

      for (const window of windows) {
        window.webContents.send('db.changes', changes);
      }
    }
  },

  /** init in main process */
  init: async (config: NeDB.DataStoreOptions = {}, forceReset = false) => {
    if (forceReset) {
      changeListeners = [];
      nedbBucket = {} as Record<AllTypes, NeDB>;
    }
    const defaultConfig: NeDB.DataStoreOptions = {
      autoload: true,
      corruptAlertThreshold: 0.9,
      ...config,
    };
    const dbPath = process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData');

    nedbBucket = {
      ApiSpec: new NeDB<ApiSpec>({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.ApiSpec.db'),
      }),
      CaCertificate: new NeDB<CaCertificate>({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.CaCertificate.db'),
      }),
      ClientCertificate: new NeDB<ClientCertificate>({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.ClientCertificate.db'),
      }),
      CloudCredential: new NeDB<CloudProviderCredential>({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.CloudCredential.db'),
      }),
      CookieJar: new NeDB<CookieJar>({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.CookieJar.db'),
      }),
      Environment: new NeDB<Environment>({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.Environment.db'),
      }),
      GitCredentials: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.GitCredentials.db'),
      }),
      GitRepository: new NeDB<GitRepository>({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.GitRepository.db'),
      }),
      GrpcRequest: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.GrpcRequest.db'),
      }),
      GrpcRequestMeta: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.GrpcRequestMeta.db'),
      }),
      MockRoute: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.MockRoute.db'),
      }),
      MockServer: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.MockServer.db'),
      }),
      OAuth2Token: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.OAuth2Token.db'),
      }),
      PluginData: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.PluginData.db'),
      }),
      Project: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.Project.db'),
      }),
      ProtoDirectory: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.ProtoDirectory.db'),
      }),
      ProtoFile: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.ProtoFile.db'),
      }),
      Request: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.Request.db'),
      }),
      RequestGroup: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.RequestGroup.db'),
      }),
      RequestGroupMeta: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.RequestGroupMeta.db'),
      }),
      RequestMeta: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.RequestMeta.db'),
      }),
      RequestVersion: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.RequestVersion.db'),
      }),
      Response: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.Response.db'),
      }),
      RunnerTestResult: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.RunnerTestResult.db'),
      }),
      Settings: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.Settings.db'),
      }),
      SocketIOPayload: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.SocketIOPayload.db'),
      }),
      SocketIORequest: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.SocketIORequest.db'),
      }),
      SocketIOResponse: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.SocketIOResponse.db'),
      }),
      Stats: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.Stats.db'),
      }),
      UnitTest: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.UnitTest.db'),
      }),
      UnitTestResult: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.UnitTestResult.db'),
      }),
      UnitTestSuite: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.UnitTestSuite.db'),
      }),
      UserSession: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.UserSession.db'),
      }),
      WebSocketPayload: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.WebSocketPayload.db'),
      }),
      WebSocketRequest: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.WebSocketRequest.db'),
      }),
      WebSocketResponse: new NeDB({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.WebSocketResponse.db'),
      }),
      Workspace: new NeDB<Workspace>({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.Workspace.db'),
      }),
      WorkspaceMeta: new NeDB<WorkspaceMeta>({
        ...defaultConfig,
        filename: fsPath.join(dbPath, 'insomnia.WorkspaceMeta.db'),
      }),
    };

    electron.ipcMain.on('db.fn', async (e, fnName, replyChannel, ...args) => {
      try {
        // @ts-expect-error -- mapping unsoundness
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
    }
  },

  insert: async function <T extends BaseModel>(doc: T) {
    if (process.type === 'renderer') {
      return _send<T>('insert', ...arguments);
    }
    const docWithDefaults = await models.initModel<T>(doc.type, doc);
    const newDoc = await nedbBucket[doc.type].insertAsync(docWithDefaults);
    notifyOfChange('insert', newDoc);
    return newDoc;
  },

  onChange: (callback: ChangeListener) => {
    changeListeners.push(callback);
  },

  /** remove doc and its descendants */
  remove: async function <T extends BaseModel>(doc: T) {
    if (process.type === 'renderer') {
      return _send<void>('remove', ...arguments);
    }

    const flushId = await database.bufferChanges();

    const docs = await database.getWithDescendants(doc);
    const docIds = docs.map(d => d._id);
    const types = [...new Set(docs.map(d => d.type))];

    // Don't really need to wait for this to be over;
    types.map(t =>
      nedbBucket[t].remove(
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

    docs.map(d => notifyOfChange('remove', d));
    await database.flushChanges(flushId);
  },

  removeWhere: async function <T extends BaseModel>(type: AllTypes, query: Query<T>) {
    if (process.type === 'renderer') {
      return _send<void>('removeWhere', ...arguments);
    }
    const flushId = await database.bufferChanges();

    for (const doc of await database.find<T>(type, query)) {
      const docs = await database.getWithDescendants(doc);
      const docIds = docs.map(d => d._id);
      const types = [...new Set(docs.map(d => d.type))];

      // Don't really need to wait for this to be over;
      types.map(t =>
        nedbBucket[t].remove(
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
      docs.map(d => notifyOfChange('remove', d));
    }

    await database.flushChanges(flushId);
  },

  /** Removes entries without removing their children */
  unsafeRemove: async function <T extends BaseModel>(doc: T) {
    if (process.type === 'renderer') {
      return _send<void>('unsafeRemove', ...arguments);
    }

    nedbBucket[doc.type].remove({ _id: doc._id });
    notifyOfChange('remove', doc);
  },

  update: async function <T extends BaseModel>(doc: T, patches: Partial<T>[] = []) {
    if (process.type === 'renderer') {
      return _send<T>('update', ...arguments);
    }

    const docWithDefaults = await models.initModel<T>(doc.type, doc);
    await nedbBucket[doc.type].updateAsync({ _id: docWithDefaults._id }, docWithDefaults, { upsert: true });
    notifyOfChange('update', docWithDefaults, patches);
    return docWithDefaults;
  },

  /** get all ancestors of specified types of a document including the original */
  withAncestors: async function <T extends BaseModel>(doc: T | undefined, types: AllTypes[] = []) {
    if (process.type === 'renderer') {
      return _send<T[]>('withAncestors', ...arguments);
    }

    if (!doc) {
      return [];
    }

    let docsToReturn: T[] = doc ? [doc] : [];
    if (types.length === 0) {
      types = Object.keys(nedbBucket) as AllTypes[];
    }
    async function next(docs: T[]): Promise<T[]> {
      const foundDocs: T[] = [];

      for (const d of docs) {
        for (const type of types) {
          // If the doc is null, we want to search for parentId === null
          const parent = await database.findOne<T>(type, { _id: d.parentId });
          parent && foundDocs.push(parent);
        }
      }

      if (foundDocs.length === 0) {
        return docsToReturn;
      }

      // Continue searching for children
      docsToReturn = [...docsToReturn, ...foundDocs];
      return next(foundDocs);
    }

    return next([doc]);
  },

  /**
   * Get a document and its descendants. Will use the descendant map to determine which types to query.
   * @param doc - The document to get descendants for.
   * @param types - Only query specified types, if provided
   * @returns A promise that resolves to an array of documents
   */
  getWithDescendants: async function <T extends BaseModel>(doc: T, types: AllTypes[] = []) {
    if (process.type === 'renderer') {
      return _send<T[]>('getWithDescendants', ...arguments);
    }

    if (!doc) return [];

    let docsToReturn: BaseModel[] = [doc];

    const queryTypesDescendantMap = types.length ? models.generateDescendantMap(types) : models.getAllDescendantMap();
    async function findDescendants(docs: BaseModel[]): Promise<BaseModel[]> {
      let foundDocs: BaseModel[] = [];

      if (docs.length > 0) {
        // Find all descendants of the current docs
        const promises: Promise<BaseModel[]>[] = [];

        const uniqueDescendantTypes = new Set<AllTypes>();
        const parentIdsMap = new Map<AllTypes, (string | null)[]>();

        for (const d of docs) {
          if (d.type) {
            queryTypesDescendantMap[d.type]?.forEach(t => {
              uniqueDescendantTypes.add(t);
              parentIdsMap.set(t, [...(parentIdsMap.get(t) || []), d._id]);
            });
          }
        }

        const queryTypes = Array.from(uniqueDescendantTypes);

        for (const type of queryTypes) {
          // If the doc is null, we want to search for parentId === null
          const promise = database.find(type, { parentId: { $in: parentIdsMap.get(type) || [] } });
          promises.push(promise);
        }

        const docBatches = await Promise.all(promises);
        foundDocs = [...foundDocs, ...docBatches.flat()];
      }

      if (foundDocs.length === 0) {
        // Didn't find anything. We're done
        return docsToReturn;
      }

      // Continue searching for children
      docsToReturn = [...docsToReturn, ...foundDocs];
      return findDescendants(foundDocs);
    }

    return findDescendants([doc]);
  },
};

let nedbBucket: Record<AllTypes, NeDB> = {} as Record<AllTypes, NeDB>;

// ~~~~~~~~~~~~~~~~ //
// Change Listeners //
// ~~~~~~~~~~~~~~~~ //
let bufferingChanges = false;
let bufferChangesId = 1;

export type ChangeBufferEvent<T extends BaseModel = BaseModel> = [event: ChangeType, doc: T, patches: Partial<T>[]];

let changeBuffer: ChangeBufferEvent[] = [];

type ChangeListener = (changes: ChangeBufferEvent[]) => void;

let changeListeners: ChangeListener[] = [];

/** push changes into the buffer, so that changeListeners can get change contents when database.flushChanges is called,
 * this method should be called whenever a document change happens */
async function notifyOfChange<T extends BaseModel>(event: ChangeType, doc: T, patches: Partial<T>[] = []) {
  const updatedDoc = doc;

  // TODO: Use object is better than array
  changeBuffer.push([event, updatedDoc, patches]);

  // Flush right away if we're not buffering
  if (!bufferingChanges) {
    await database.flushChanges();
  }
}

// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //
// If you call database.x methods within the render process, you can obtain results by this helper function
async function _send<T>(fnName: string, ...args: any[]) {
  return new Promise<T>((resolve, reject) => {
    const replyChannel = `db.fn.reply:${uuidv4()}`;
    electron.ipcRenderer.send('db.fn', fnName, replyChannel, ...args);
    electron.ipcRenderer.once(replyChannel, (_e, err, result: T) => (err ? reject(err) : resolve(result)));
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
  const existsAndFilenameIsDefaultOrMissing =
    apiSpec && (!apiSpec.fileName || apiSpec.fileName === models.apiSpec.init().fileName);
  if (existsAndFilenameIsDefaultOrMissing) {
    await models.apiSpec.update(apiSpec, { fileName: workspace.name });
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

// Append .git to old git URIs to mimic previous isomorphic-git behavior
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
