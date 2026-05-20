// NeDB Database implementation for main process and Node.js environments
// This is the core database implementation using NeDB as the storage backend.

import os from 'node:os';
import fsPath from 'node:path';

import NeDB from '@seald-io/nedb';

import { generateId } from '~/common/misc';
import type {
  AllTypes,
  ApiSpec,
  BaseModel,
  ChangeBufferEvent,
  ChangeListener,
  ChangeType,
  ClientCertificate,
  CloudProviderCredential,
  CookieJar,
  DataStoreOptions,
  Environment,
  GitRepository,
  IDatabase,
  Operation,
  ProjectLintRuleset,
  Query,
  Workspace,
  WorkspaceMeta,
} from '~/insomnia-data';
import { models } from '~/insomnia-data';

import { initModel } from './init-model';
import { repairDatabase } from './repair-database';

const getTempPath = (name: string) => {
  return name === 'temp' ? os.tmpdir() : fsPath.join(os.tmpdir(), 'insomnia-send-request');
};

type initOptions = DataStoreOptions & { dbPath?: string };

/**
 * Create the NeDB database implementation for main process and Node.js.
 */
export const createNedbDatabase = <O = initOptions>(
  wrapper?: (nedbDatabase: IDatabase<initOptions>) => IDatabase<O>,
) => {
  const originalDatabase: IDatabase<initOptions> = {
    batchModifyDocs: async function ({ upsert = [], remove = [] }: Operation) {
      const flushId = await database.bufferChanges();

      // Perform from least to most dangerous
      await Promise.all(upsert.map(doc => database.update(doc)));
      await Promise.all(remove.map(doc => database.unsafeRemove(doc)));

      await database.flushChanges(flushId);
    },

    /** buffers database changes and returns a buffer id, automatically call flushChanges in millis,
     * bufferChanges and flushChanges should be called in pair every time documents changes are made to trigger change listeners */
    bufferChanges: async function (millis = 1000) {
      bufferingChanges = true;
      setTimeout(database.flushChanges, millis);
      return ++bufferChangesId;
    },

    /** buffers database changes and returns a buffer id */
    bufferChangesIndefinitely: async function () {
      bufferingChanges = true;
      return ++bufferChangesId;
    },

    /** return count num of documents matching query */
    count: async function <T extends BaseModel>(type: AllTypes, query: Query<T> = {}) {
      return nedbBucket[type].countAsync(query);
    },

    docCreate: async <T extends BaseModel>(type: AllTypes, ...patches: Partial<T>[]) => {
      const doc = await initModel<T>(
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
      const doc = await initModel<T>(
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
      const flushId = await database.bufferChanges();
      const descendantMap = models.getAllDescendantMap();

      const idMapping = new Map<string, string>();
      const allDocs: { doc: BaseModel; parentId: string }[] = [];

      async function collectDescendants(doc: BaseModel): Promise<void> {
        const model = models.mustGetModel(doc.type);
        idMapping.set(doc._id, generateId(model.prefix));

        const validChildTypes = (descendantMap[doc.type] ?? []).filter(t => models.canDuplicate(t));
        for (const childType of validChildTypes) {
          for (const child of await database.find(childType, { parentId: doc._id })) {
            allDocs.push({ doc: child, parentId: doc._id });
            await collectDescendants(child);
          }
        }
      }
      await collectDescendants(originalDoc);

      const updateTime = Date.now();

      // Duplicate the root document
      const rootRewritten: T = models.rewriteReferences(originalDoc, idMapping);
      const rootDoc = {
        ...rootRewritten,
        ...patch,
        _id: idMapping.get(originalDoc._id)!,
        modified: updateTime,
        created: updateTime,
        type: originalDoc.type,
      };
      const createdDoc = (await nedbBucket[originalDoc.type].insertAsync(rootDoc)) as T;

      // Duplicate all descendants
      for (const { doc, parentId } of allDocs) {
        const rewritten = models.rewriteReferences(doc, idMapping);
        const newDoc = {
          ...rewritten,
          _id: idMapping.get(doc._id)!,
          parentId: idMapping.get(parentId)!,
          modified: updateTime,
          created: updateTime,
          type: doc.type,
        };
        await nedbBucket[doc.type].insertAsync(newDoc);
      }

      await database.flushChanges(flushId);
      return createdDoc;
    },
    findOne: async function <T extends BaseModel>(
      type: AllTypes,
      query: Query<T> | string = {},
      sort: Record<string, any> = { created: 1 },
    ): Promise<T | undefined> {
      const doc = await nedbBucket[type].findOneAsync<T>(query).sort(sort);
      if (doc === null) {
        return undefined;
      }
      return initModel<T>(type, doc);
    },
    /** find documents matching query */
    find: async function <T extends BaseModel>(
      type: AllTypes,
      query: Query<T> | string = {},
      sort: Record<string, any> = { created: 1 },
      limit = 0,
    ): Promise<T[]> {
      if (!nedbBucket[type]) {
        console.warn(`[db] No collection for type "${type}"`);
        return [];
      }
      const docs = await nedbBucket[type].findAsync<T>(query).sort(sort).limit(limit);
      // TODO: create a db init phase for migrations rather than doing it on every find.
      const migrated = [];
      for (const rawDoc of docs) {
        migrated.push(await initModel<T>(type, rawDoc));
      }
      return migrated;
    },

    /** trigger all changeListeners */
    flushChanges: async function (id = 0, fake = false) {
      await flushChangesImpl(id, fake);
    },

    /** init in main process */
    init: async ({ dbPath, ...config }: initOptions = {}, forceReset = false) => {
      if (forceReset) {
        changeListeners = [];
        nedbBucket = {} as Record<AllTypes, NeDB>;
      }
      const defaultConfig: NeDB.DataStoreOptions = {
        autoload: true,
        corruptAlertThreshold: 0.9,
        ...config,
      };

      if (!dbPath) {
        dbPath = process.env['INSOMNIA_DATA_PATH'] || getTempPath('userData');
      }

      nedbBucket = {
        ApiSpec: new NeDB<ApiSpec>({
          ...defaultConfig,
          filename: fsPath.join(dbPath, 'insomnia.ApiSpec.db'),
        }),
        CaCertificate: new NeDB({
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
        McpRequest: new NeDB({
          ...defaultConfig,
          filename: fsPath.join(dbPath, 'insomnia.McpRequest.db'),
        }),
        McpResponse: new NeDB({
          ...defaultConfig,
          filename: fsPath.join(dbPath, 'insomnia.McpResponse.db'),
        }),
        McpPayload: new NeDB({
          ...defaultConfig,
          filename: fsPath.join(dbPath, 'insomnia.McpPayload.db'),
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
        ProjectLintRuleset: new NeDB<ProjectLintRuleset>({
          ...defaultConfig,
          filename: fsPath.join(dbPath, 'insomnia.ProjectLintRuleset.db'),
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
        SocketIORequestMeta: new NeDB({
          ...defaultConfig,
          filename: fsPath.join(dbPath, 'insomnia.SocketIORequestMeta.db'),
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
        WebSocketRequestMeta: new NeDB({
          ...defaultConfig,
          filename: fsPath.join(dbPath, 'insomnia.WebSocketRequestMeta.db'),
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

      // NOTE: Only repair the DB if we're not running in memory. Repairing here causes tests to hang indefinitely for some reason.
      // TODO: Figure out why this makes tests hang
      if (!config.inMemoryOnly) {
        await repairDatabase();
      }
    },

    insert: async function <T extends BaseModel>(doc: T) {
      const docWithDefaults = await initModel<T>(doc.type, doc);
      const newDoc = await nedbBucket[doc.type].insertAsync(docWithDefaults);
      notifyOfChange('insert', newDoc);
      return newDoc;
    },

    onChange: (callback: ChangeListener) => {
      changeListeners.push(callback);
    },

    /** remove doc and its descendants */
    remove: async function <T extends BaseModel>(doc: T) {
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
      nedbBucket[doc.type].remove({ _id: doc._id });
      notifyOfChange('remove', doc);
    },

    update: async function <T extends BaseModel>(doc: T, patches: Partial<T>[] = []) {
      const docWithDefaults = await initModel<T>(doc.type, doc);
      await nedbBucket[doc.type].updateAsync({ _id: docWithDefaults._id }, docWithDefaults, { upsert: true });
      notifyOfChange('update', docWithDefaults, patches);
      return docWithDefaults;
    },

    /** get all ancestors of specified types of a document including the original */
    withAncestors: async function <T extends BaseModel>(doc: T | undefined, types: AllTypes[] = []) {
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

  const database = wrapper ? wrapper(originalDatabase) : originalDatabase;
  return database as IDatabase<O>;
};

let nedbBucket: Record<AllTypes, NeDB> = {} as Record<AllTypes, NeDB>;

// ~~~~~~~~~~~~~~~~ //
// Change Listeners //
// ~~~~~~~~~~~~~~~~ //
let bufferingChanges = false;
let bufferChangesId = 1;

let changeBuffer: ChangeBufferEvent[] = [];

let changeListeners: ChangeListener[] = [];

/** trigger all changeListeners */
export const flushChangesImpl = async function (id = 0, fake = false): Promise<ChangeBufferEvent[] | void> {
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

  return changes;
};
