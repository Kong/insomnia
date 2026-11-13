// NeDB Database implementation for main process and Node.js environments
// This is the core database implementation using NeDB as the storage backend.

import os from 'node:os';
import fsPath from 'node:path';

import NeDB from '@seald-io/nedb';
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
} from 'insomnia-data';
import { models } from 'insomnia-data';
import { generateId } from 'insomnia-data/common';

import {
  createFieldDecryptionFailureReport,
  createFieldEncryptionHooks,
  type FieldDecryptionFailure,
  getHooksForType,
  reconcileFieldDecryptionFailures,
} from './field-encryption/hooks';
import { forEachEncryptedLeaf } from './field-encryption/paths';
import { type FieldEncryptionKey, isWellFormedCiphertext } from './field-encryption/value';
import { initModel } from './init-model';
import { repairDatabase } from './repair-database';

const getTempPath = (name: string) => {
  return name === 'temp' ? os.tmpdir() : fsPath.join(os.tmpdir(), 'insomnia-send-request');
};

type initOptions = DataStoreOptions & {
  dbPath?: string;
  /** Encrypts the sensitive fields of every datastore of this instance. Ignored for `inMemoryOnly` instances. */
  fieldEncryptionKey?: FieldEncryptionKey;
};

type FlushChangesImpl = (id?: number, fake?: boolean) => Promise<ChangeBufferEvent[] | void>;

interface DatabaseInternals {
  flushChangesImpl: FlushChangesImpl;
  /** The fields that could not be decrypted when the datastores were loaded by the last `init()`. */
  getFieldDecryptionFailures: () => FieldDecryptionFailure[];
  /**
   * Checks the failure report against the data as it is now, drops the entries that no longer describe it (the field was
   * reset or edited, or the document was removed since the load), and returns what is left.
   */
  refreshFieldDecryptionFailures: () => Promise<FieldDecryptionFailure[]>;
  /**
   * Sets every field that still holds ciphertext that could not be decrypted to an empty string, and returns how many
   * fields were cleared. A field that was edited since the load is not touched.
   */
  resetFieldDecryptionFailures: () => Promise<number>;
}

/**
 * Create the NeDB database implementation for main process and Node.js.
 * Every instance keeps its own collections and change listeners, so an extra
 * instance (e.g. an in-memory scratch database) never affects another one.
 */
export const createNedbDatabase = <O = initOptions>(
  wrapper?: (nedbDatabase: IDatabase<initOptions>, internals: DatabaseInternals) => IDatabase<O>,
) => {
  let nedbBucket: Record<AllTypes, NeDB> = {} as Record<AllTypes, NeDB>;
  let fieldDecryptionFailureReport = createFieldDecryptionFailureReport();

  // ~~~~~~~~~~~~~~~~ //
  // Change Listeners //
  // ~~~~~~~~~~~~~~~~ //
  let bufferingChanges = false;
  let bufferChangesId = 1;

  let changeBuffer: ChangeBufferEvent[] = [];

  let changeListeners: ChangeListener[] = [];

  /** trigger all changeListeners */
  const flushChangesImpl: FlushChangesImpl = async function (id = 0, fake = false) {
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
      const flushId = await database.bufferChangesIndefinitely();
      try {
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
        notifyOfChange('insert', createdDoc);

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
          const createdDescendant = await nedbBucket[doc.type].insertAsync(newDoc);
          notifyOfChange('insert', createdDescendant);
        }

        return createdDoc;
      } finally {
        await database.flushChanges(flushId);
      }
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
    init: async ({ dbPath, fieldEncryptionKey, ...config }: initOptions = {}, forceReset = false) => {
      if (forceReset) {
        changeListeners = [];
        nedbBucket = {} as Record<AllTypes, NeDB>;
      }

      fieldDecryptionFailureReport = createFieldDecryptionFailureReport();
      const encryptionEnabled = !!fieldEncryptionKey && !config.inMemoryOnly;
      // Derive the encrypted path table now, so a broken model schema fails init() instead of the first hook call
      const encryptedFieldPaths = encryptionEnabled ? models.getEncryptedFieldPathsByType() : undefined;
      // The same hooks serve every datastore that has encrypted fields (see configForType)
      const encryptionHooks = encryptionEnabled
        ? createFieldEncryptionHooks(fieldEncryptionKey, {
            getEncryptedFieldPaths: models.getEncryptedFieldPathsForType,
            failureReport: fieldDecryptionFailureReport,
          })
        : {};

      const defaultConfig: NeDB.DataStoreOptions = {
        corruptAlertThreshold: 0.9,
        // Without an onload handler NeDB rethrows a failed load as an unhandled rejection. init() reports it below.
        onload: () => {},
        ...config,
        // Not overridable: init() waits for every load below, and a datastore that was never loaded never answers a query
        autoload: true,
      };

      // Only the datastores that have encrypted fields get the hooks: every other line is read and written exactly as
      // without encryption, instead of being parsed and serialized again for nothing
      const configForType = (type: AllTypes): NeDB.DataStoreOptions => ({
        ...defaultConfig,
        ...getHooksForType(encryptionHooks, type, t => encryptedFieldPaths?.[t as AllTypes] ?? []),
      });

      if (!dbPath) {
        dbPath = process.env['INSOMNIA_DATA_PATH'] || getTempPath('userData');
      }

      nedbBucket = {
        ApiSpec: new NeDB<ApiSpec>({
          ...configForType('ApiSpec'),
          filename: fsPath.join(dbPath, 'insomnia.ApiSpec.db'),
        }),
        CaCertificate: new NeDB({
          ...configForType('CaCertificate'),
          filename: fsPath.join(dbPath, 'insomnia.CaCertificate.db'),
        }),
        ClientCertificate: new NeDB<ClientCertificate>({
          ...configForType('ClientCertificate'),
          filename: fsPath.join(dbPath, 'insomnia.ClientCertificate.db'),
        }),
        CloudCredential: new NeDB<CloudProviderCredential>({
          ...configForType('CloudCredential'),
          filename: fsPath.join(dbPath, 'insomnia.CloudCredential.db'),
        }),
        CookieJar: new NeDB<CookieJar>({
          ...configForType('CookieJar'),
          filename: fsPath.join(dbPath, 'insomnia.CookieJar.db'),
        }),
        Environment: new NeDB<Environment>({
          ...configForType('Environment'),
          filename: fsPath.join(dbPath, 'insomnia.Environment.db'),
        }),
        GitCredentials: new NeDB({
          ...configForType('GitCredentials'),
          filename: fsPath.join(dbPath, 'insomnia.GitCredentials.db'),
        }),
        GitRepository: new NeDB<GitRepository>({
          ...configForType('GitRepository'),
          filename: fsPath.join(dbPath, 'insomnia.GitRepository.db'),
        }),
        GrpcRequest: new NeDB({
          ...configForType('GrpcRequest'),
          filename: fsPath.join(dbPath, 'insomnia.GrpcRequest.db'),
        }),
        GrpcRequestMeta: new NeDB({
          ...configForType('GrpcRequestMeta'),
          filename: fsPath.join(dbPath, 'insomnia.GrpcRequestMeta.db'),
        }),
        MockRoute: new NeDB({
          ...configForType('MockRoute'),
          filename: fsPath.join(dbPath, 'insomnia.MockRoute.db'),
        }),
        MockServer: new NeDB({
          ...configForType('MockServer'),
          filename: fsPath.join(dbPath, 'insomnia.MockServer.db'),
        }),
        McpRequest: new NeDB({
          ...configForType('McpRequest'),
          filename: fsPath.join(dbPath, 'insomnia.McpRequest.db'),
        }),
        McpResponse: new NeDB({
          ...configForType('McpResponse'),
          filename: fsPath.join(dbPath, 'insomnia.McpResponse.db'),
        }),
        McpPayload: new NeDB({
          ...configForType('McpPayload'),
          filename: fsPath.join(dbPath, 'insomnia.McpPayload.db'),
        }),
        OAuth2Token: new NeDB({
          ...configForType('OAuth2Token'),
          filename: fsPath.join(dbPath, 'insomnia.OAuth2Token.db'),
        }),
        PluginData: new NeDB({
          ...configForType('PluginData'),
          filename: fsPath.join(dbPath, 'insomnia.PluginData.db'),
        }),
        Project: new NeDB({
          ...configForType('Project'),
          filename: fsPath.join(dbPath, 'insomnia.Project.db'),
        }),
        ProjectLintRuleset: new NeDB<ProjectLintRuleset>({
          ...configForType('ProjectLintRuleset'),
          filename: fsPath.join(dbPath, 'insomnia.ProjectLintRuleset.db'),
        }),
        ProtoDirectory: new NeDB({
          ...configForType('ProtoDirectory'),
          filename: fsPath.join(dbPath, 'insomnia.ProtoDirectory.db'),
        }),
        ProtoFile: new NeDB({
          ...configForType('ProtoFile'),
          filename: fsPath.join(dbPath, 'insomnia.ProtoFile.db'),
        }),
        Request: new NeDB({
          ...configForType('Request'),
          filename: fsPath.join(dbPath, 'insomnia.Request.db'),
        }),
        RequestGroup: new NeDB({
          ...configForType('RequestGroup'),
          filename: fsPath.join(dbPath, 'insomnia.RequestGroup.db'),
        }),
        RequestGroupMeta: new NeDB({
          ...configForType('RequestGroupMeta'),
          filename: fsPath.join(dbPath, 'insomnia.RequestGroupMeta.db'),
        }),
        RequestMeta: new NeDB({
          ...configForType('RequestMeta'),
          filename: fsPath.join(dbPath, 'insomnia.RequestMeta.db'),
        }),
        RequestVersion: new NeDB({
          ...configForType('RequestVersion'),
          filename: fsPath.join(dbPath, 'insomnia.RequestVersion.db'),
        }),
        Response: new NeDB({
          ...configForType('Response'),
          filename: fsPath.join(dbPath, 'insomnia.Response.db'),
        }),
        RunnerTestResult: new NeDB({
          ...configForType('RunnerTestResult'),
          filename: fsPath.join(dbPath, 'insomnia.RunnerTestResult.db'),
        }),
        Settings: new NeDB({
          ...configForType('Settings'),
          filename: fsPath.join(dbPath, 'insomnia.Settings.db'),
        }),
        SocketIOPayload: new NeDB({
          ...configForType('SocketIOPayload'),
          filename: fsPath.join(dbPath, 'insomnia.SocketIOPayload.db'),
        }),
        SocketIORequest: new NeDB({
          ...configForType('SocketIORequest'),
          filename: fsPath.join(dbPath, 'insomnia.SocketIORequest.db'),
        }),
        SocketIORequestMeta: new NeDB({
          ...configForType('SocketIORequestMeta'),
          filename: fsPath.join(dbPath, 'insomnia.SocketIORequestMeta.db'),
        }),
        SocketIOResponse: new NeDB({
          ...configForType('SocketIOResponse'),
          filename: fsPath.join(dbPath, 'insomnia.SocketIOResponse.db'),
        }),
        Stats: new NeDB({
          ...configForType('Stats'),
          filename: fsPath.join(dbPath, 'insomnia.Stats.db'),
        }),
        UnitTest: new NeDB({
          ...configForType('UnitTest'),
          filename: fsPath.join(dbPath, 'insomnia.UnitTest.db'),
        }),
        UnitTestResult: new NeDB({
          ...configForType('UnitTestResult'),
          filename: fsPath.join(dbPath, 'insomnia.UnitTestResult.db'),
        }),
        UnitTestSuite: new NeDB({
          ...configForType('UnitTestSuite'),
          filename: fsPath.join(dbPath, 'insomnia.UnitTestSuite.db'),
        }),
        UserSession: new NeDB({
          ...configForType('UserSession'),
          filename: fsPath.join(dbPath, 'insomnia.UserSession.db'),
        }),
        WebSocketPayload: new NeDB({
          ...configForType('WebSocketPayload'),
          filename: fsPath.join(dbPath, 'insomnia.WebSocketPayload.db'),
        }),
        WebSocketRequest: new NeDB({
          ...configForType('WebSocketRequest'),
          filename: fsPath.join(dbPath, 'insomnia.WebSocketRequest.db'),
        }),
        WebSocketRequestMeta: new NeDB({
          ...configForType('WebSocketRequestMeta'),
          filename: fsPath.join(dbPath, 'insomnia.WebSocketRequestMeta.db'),
        }),
        WebSocketResponse: new NeDB({
          ...configForType('WebSocketResponse'),
          filename: fsPath.join(dbPath, 'insomnia.WebSocketResponse.db'),
        }),
        Workspace: new NeDB<Workspace>({
          ...configForType('Workspace'),
          filename: fsPath.join(dbPath, 'insomnia.Workspace.db'),
        }),
        WorkspaceMeta: new NeDB<WorkspaceMeta>({
          ...configForType('WorkspaceMeta'),
          filename: fsPath.join(dbPath, 'insomnia.WorkspaceMeta.db'),
        }),
      };

      // Wait for every datastore to load. A datastore whose load failed never becomes ready, and its queries would
      // otherwise wait forever, so report it here instead of hanging at the first query.
      const loads = Object.entries(nedbBucket);
      const results = await Promise.allSettled(loads.map(([, datastore]) => datastore.autoloadPromise));
      const failures = results.flatMap((result, i) =>
        result.status === 'rejected' ? [{ type: loads[i][0], reason: result.reason }] : [],
      );
      if (failures.length > 0) {
        // A datastore whose load failed never becomes ready: drop them all, so that any later use fails at once
        // instead of waiting forever
        nedbBucket = {} as Record<AllTypes, NeDB>;
        const description = failures
          .map(({ type, reason }) => `${type} (${reason instanceof Error ? reason.message : String(reason)})`)
          .join(', ');
        throw new AggregateError(
          failures.map(({ reason }) => reason),
          `Failed to load datastores: ${description}`,
        );
      }

      if (encryptionEnabled) {
        await refreshFieldDecryptionFailures();
      }

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

    /** get all ancestors of specified types of a document including the original, the order of the returned array is leaf to root */
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

  const refreshFieldDecryptionFailures = async () => {
    await reconcileFieldDecryptionFailures(
      fieldDecryptionFailureReport,
      models.getEncryptedFieldPathsForType,
      async (type, _id) => nedbBucket[type as AllTypes]?.findOneAsync({ _id }),
    );
    return fieldDecryptionFailureReport.list();
  };

  const resetFieldDecryptionFailures = async () => {
    const failuresByDocument = new Map<string, { type: AllTypes; _id: string; paths: Set<string> }>();
    for (const { type, _id, path } of await refreshFieldDecryptionFailures()) {
      const documentKey = JSON.stringify([type, _id]);
      const entry = failuresByDocument.get(documentKey) ?? { type: type as AllTypes, _id, paths: new Set<string>() };
      entry.paths.add(path);
      failuresByDocument.set(documentKey, entry);
    }

    let cleared = 0;
    const flushId = await database.bufferChangesIndefinitely();
    try {
      for (const { type, _id, paths } of failuresByDocument.values()) {
        const doc = await nedbBucket[type]?.findOneAsync<BaseModel>({ _id });
        if (!doc) {
          continue;
        }
        // The value is checked again here, so a field that was edited after the report was made keeps its new value
        const patch: Record<string, unknown> = {};
        forEachEncryptedLeaf(doc, models.getEncryptedFieldPathsForType(type), ({ container, key, path }) => {
          const value = container[key];
          if (paths.has(path) && typeof value === 'string' && isWellFormedCiphertext(value)) {
            container[key] = '';
            const topLevelKey = path.split(/[.[]/)[0];
            patch[topLevelKey] = (doc as unknown as Record<string, unknown>)[topLevelKey];
            cleared++;
          }
        });
        if (Object.keys(patch).length > 0) {
          await database.docUpdate(doc, patch as Partial<BaseModel>);
        }
      }
    } finally {
      await database.flushChanges(flushId);
    }
    await refreshFieldDecryptionFailures();
    return cleared;
  };

  const database = wrapper
    ? wrapper(originalDatabase, {
        flushChangesImpl,
        getFieldDecryptionFailures: () => fieldDecryptionFailureReport.list(),
        refreshFieldDecryptionFailures,
        resetFieldDecryptionFailures,
      })
    : originalDatabase;
  return database as IDatabase<O>;
};
