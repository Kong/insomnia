import electron from 'electron';
import NeDB from 'nedb';
import path from 'path';

import { DB_PERSIST_INTERVAL } from '../common/constants';
import { database } from '../common/database';
import { ChangeBufferEvent, Database, docUpdate, ModelQuery, Operation, Query, Sort } from '../common/dbtypes';
import { ChangeType, DatabaseCommon } from '../common/dbtypes';
import { getDataDirectory } from '../common/electron-helpers';
import { generateId } from '../common/misc';
import { mustGetModel } from '../models';
import { CookieJar } from '../models/cookie-jar';
import { Environment } from '../models/environment';
import { GitRepository } from '../models/git-repository';
import { getMonkeyPatchedControlledSettings } from '../models/helpers/settings';
import type { BaseModel } from '../models/index';
import * as models from '../models/index';
import { isSettings } from '../models/settings';
import type { Workspace } from '../models/workspace';

interface DB {
  [index: string]: NeDB;
}

export class DatabaseHost extends DatabaseCommon implements Database {
  private readonly db: DB = {};

  private constructor() {
    super();
  }

  private static getDBFilePath(modelType: string): string {
    // NOTE: Do not EVER change this. EVER!
    return path.join(getDataDirectory(), `insomnia.${modelType}.db`);
  }

  static async init(
    types: string[],
    config: NeDB.DataStoreOptions = {},
    consoleLog: typeof console.log = console.log
  ): Promise<DatabaseHost> {
    const host = new DatabaseHost();
    database.setImplementation(host);
    await host.init(types, config, consoleLog);
    return host;
  }

  private async init(
    types: string[],
    config: NeDB.DataStoreOptions = {},
    consoleLog: typeof console.log = console.log,
  ) {
    // Fill in the defaults
    for (const modelType of types) {
      if (this.db[modelType]) {
        consoleLog(`[db] Already initialized DB.${modelType}`);
        continue;
      }

      const filePath = DatabaseHost.getDBFilePath(modelType);
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
      if (!config.inMemoryOnly) {
        collection.persistence.setAutocompactionInterval(DB_PERSIST_INTERVAL);
      }
      this.db[modelType] = collection;
    }

    electron.ipcMain.handle('db.fn', this.handleIpc);

    // NOTE: Only repair the DB if we're not running in memory. Repairing here causes tests to hang indefinitely for some reason.
    // TODO: Figure out why this makes tests hang
    if (!config.inMemoryOnly) {
      await this._repairDatabase();
      consoleLog(`[db] Initialized DB at ${DatabaseHost.getDBFilePath('$TYPE')}`);
    }

    // This isn't the best place for this but w/e
    // Listen for response deletions and delete corresponding response body files
    this.onChange(async changes => {
      for (const [type, doc] of changes) {
        // TODO(TSCONVERSION) what's returned here is the entire model implementation, not just a model
        // The type definition will be a little confusing
        const m: Record<string, any> | null = models.getModel(doc.type);

        if (!m) {
          continue;
        }

        if (type === ChangeType.REMOVE && typeof m.hookRemove === 'function') {
          try {
            await m.hookRemove(doc, consoleLog);
          } catch (err) {
            consoleLog(`[db] Delete hook failed for ${type} ${doc._id}: ${err.message}`);
          }
        }

        if (type === ChangeType.INSERT && typeof m.hookInsert === 'function') {
          try {
            await m.hookInsert(doc, consoleLog);
          } catch (err) {
            consoleLog(`[db] Insert hook failed for ${type} ${doc._id}: ${err.message}`);
          }
        }

        if (type === ChangeType.UPDATE && typeof m.hookUpdate === 'function') {
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

  /**
   * Run various database repair scripts
   */
  async _repairDatabase() {
    console.log('[fix] Running database repairs');

    for (const workspace of await (this.find(models.workspace.type) as Promise<Workspace[]>)) {
      await this._repairBaseEnvironments(workspace);
      await this._fixMultipleCookieJars(workspace);
      await this._applyApiSpecName(workspace);
    }

    for (const gitRepository of await (this.find(models.gitRepository.type) as Promise<GitRepository[]>)) {
      await this._fixOldGitURIs(gitRepository);
    }
  }

  allTypes = () => Object.keys(this.db);

  private readonly handleIpc = async<T extends keyof Database>(
    _event: Electron.IpcMainEvent,
    fnName: T,
    ...args: Parameters<Database[T]>
  ): Promise<Awaited<ReturnType<Database[T]>>> => {
    // Need apply to bind this.
    // eslint-disable-next-line prefer-spread
    return await this[fnName].apply(this, args);
  };

  async all<T extends BaseModel = BaseModel>(type: string): Promise<T[]> {
    return this.find(type);
  }

  async batchModifyDocs({ upsert = [], remove = [] }: Operation): Promise<void> {
    const flushId = await this.bufferChanges();

    // Perform from least to most dangerous
    await Promise.all(upsert.map(doc => this.upsert(doc, true)));
    await Promise.all(remove.map(doc => this.unsafeRemove(doc, true)));

    await this.flushChanges(flushId);
  }

  /** buffers database changes and returns a buffer id */
  async bufferChanges(millis = 1000): Promise<number> {
    this.bufferingChanges = true;
    setTimeout(() => this.flushChanges(), millis);
    return ++this.bufferChangesId;
  }

  /** buffers database changes and returns a buffer id */
  async bufferChangesIndefinitely(): Promise<number> {
    this.bufferingChanges = true;
    return ++this.bufferChangesId;
  }

  async count(type: string, query: Query = {}): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.db[type].count(query, (err, count) => {
        if (err) {
          return reject(err);
        }

        resolve(count);
      });
    });
  }

  async duplicate<T extends BaseModel = BaseModel>(originalDoc: T, patch: Partial<T> = {}): Promise<T> {
    const flushId = await this.bufferChanges();

    const next = async (docToCopy: T, patch: Partial<BaseModel>): Promise<T> => {
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
      const createdDoc = await this.insert<T>(newDoc, false, false);

      // 2. Get all the children
      for (const type of this.allTypes()) {
        // Note: We never want to duplicate a response
        if (!models.canDuplicate(type)) {
          continue;
        }

        const parentId = docToCopy._id;
        const children = await this.find<T>(type, { parentId });

        for (const doc of children) {
          await next(doc, { parentId: createdDoc._id });
        }
      }

      return createdDoc;
    };

    const createdDoc = await next(originalDoc, patch);
    await this.flushChanges(flushId);
    return createdDoc;
  }

  async find<T extends BaseModel = BaseModel>(
    type: string,
    query: Query | string = {},
    sort: Sort = { created: 1 },
  ): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      (this.db[type] as NeDB<T>)
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
  }

  async findMostRecentlyModified<T extends BaseModel = BaseModel>(
    type: string,
    query: Query = {},
    limit: number | null = null,
  ): Promise<T[]> {
    return new Promise<T[]>(resolve => {
      (this.db[type] as NeDB<T>)
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
  }

  async flushChanges(id = 0, fake = false): Promise<void> {
    // Only flush if ID is 0 or the current flush ID is the same as passed
    if (id !== 0 && this.bufferChangesId !== id) {
      return;
    }

    this.bufferingChanges = false;
    const changes = [...this.changeBuffer];
    this.changeBuffer = [];

    if (changes.length === 0) {
      // No work to do
      return;
    }

    if (fake) {
      console.log(`[db] Dropped ${changes.length} changes.`);
      return;
    }

    // Notify local listeners too
    for (const fn of this.changeListeners) {
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
  }

  async get<T extends BaseModel = BaseModel>(type: string, id?: string): Promise<T | null> {
    // Short circuit IDs used to represent nothing
    if (!id || id === 'n/a') {
      return null;
    } else {
      return this.getWhere<T>(type, { _id: id });
    }
  }

  async getMostRecentlyModified<T extends BaseModel = BaseModel>(type: string, query: Query = {}): Promise<T | null> {
    const docs = await this.findMostRecentlyModified<T>(type, query, 1);
    return docs.length ? docs[0] : null;
  }

  async getWhere<T extends BaseModel = BaseModel>(type: string, query: ModelQuery<BaseModel> | Query): Promise<T | null> {
    // @ts-expect-error -- TSCONVERSION type narrowing needed
    const docs = await this.find<T>(type, query);
    return docs.length ? docs[0] : null;
  }

  async insert<T extends BaseModel = BaseModel>(doc: T, fromSync = false, initializeModel = true): Promise<T> {
    return new Promise(async (resolve, reject) => {
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

      this.db[doc.type].insert<T>(docWithDefaults, (err, newDoc: T) => {
        if (err) {
          return reject(err);
        }

        resolve(newDoc);
        // NOTE: This needs to be after we resolve
        this.notifyOfChange(ChangeType.INSERT, newDoc, fromSync);
      });
    });
  }

  async remove(doc: BaseModel, fromSync = false): Promise<void> {
    const flushId = await this.bufferChanges();

    const docs = await this.withDescendants(doc);
    const docIds = docs.map(d => d._id);
    const types = [...new Set(docs.map(d => d.type))];

    // Don't really need to wait for this to be over;
    types.map(t =>
      this.db[t].remove(
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

    docs.map(d => this.notifyOfChange(ChangeType.REMOVE, d, fromSync));
    await this.flushChanges(flushId);
  }

  async removeWhere(type: string, query: Query): Promise<void> {
    const flushId = await this.bufferChanges();

    for (const doc of await this.find(type, query)) {
      const docs = await this.withDescendants(doc);
      const docIds = docs.map(d => d._id);
      const types = [...new Set(docs.map(d => d.type))];

      // Don't really need to wait for this to be over;
      types.map(t =>
        this.db[t].remove(
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
      docs.map(d => this.notifyOfChange(ChangeType.REMOVE, d, false));
    }

    await this.flushChanges(flushId);
  }

  /** Removes entries without removing their children */
  async unsafeRemove(doc: BaseModel, fromSync = false): Promise<void> {
    this.db[doc.type].remove({ _id: doc._id });
    this.notifyOfChange(ChangeType.REMOVE, doc, fromSync);
  }

  async update<T extends BaseModel = BaseModel>(doc: T, fromSync = false): Promise<T> {
    return new Promise<T>(async (resolve, reject) => {
      let docWithDefaults: T;

      try {
        docWithDefaults = await models.initModel(doc.type, doc);
      } catch (err) {
        return reject(err);
      }

      this.db[doc.type].update(
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
          this.notifyOfChange(ChangeType.UPDATE, docWithDefaults, fromSync);
        },
      );
    });
  }

  // TODO(TSCONVERSION) the update method above can now take an upsert property
  async upsert<T extends BaseModel = BaseModel>(doc: T, fromSync = false): Promise<T> {
    const existingDoc = await this.get(doc.type, doc._id);

    if (existingDoc) {
      return this.update<T>(doc, fromSync);
    } else {
      return this.insert<T>(doc, fromSync);
    }
  }

  async withAncestors<T extends BaseModel = BaseModel>(doc: T | null, types: string[] = this.allTypes()): Promise<T[]> {
    if (!doc) {
      return [];
    }

    let docsToReturn: T[] = doc ? [doc] : [];

    const next = async (docs: T[]): Promise<T[]> => {
      const foundDocs: T[] = [];

      for (const d of docs) {
        for (const type of types) {
          // If the doc is null, we want to search for parentId === null
          const another = await this.get<T>(type, d.parentId);
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
    };

    return next([doc]);
  }

  async withDescendants<T extends BaseModel = BaseModel>(doc: T | null, stopType: string | null = null): Promise<T[]> {
    let docsToReturn: T[] = doc ? [doc] : [];

    const  next = async (docs: (T | null)[]): Promise<T[]> => {
      let foundDocs: T[] = [];

      for (const doc of docs) {
        if (stopType && doc && doc.type === stopType) {
          continue;
        }

        const promises: Promise<T[]>[] = [];

        for (const type of this.allTypes()) {
          // If the doc is null, we want to search for parentId === null
          const parentId = doc ? doc._id : null;
          const promise = this.find<T>(type, { parentId });
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
    };

    return next([doc]);
  }

  // ~~~~~~~~~~~~~~~~ //
  // Change Listeners //
  // ~~~~~~~~~~~~~~~~ //
  bufferingChanges = false;
  bufferChangesId = 1;

  changeBuffer: ChangeBufferEvent[] = [];

  async notifyOfChange<T extends BaseModel>(event: string, doc: T, fromSync: boolean) {
    let updatedDoc = doc;

    // NOTE: this monkeypatching is temporary, and was determined to have the smallest blast radius if it exists here (rather than, say, a reducer or an action creator).
    // see: INS-1059
    if (isSettings(doc)) {
      updatedDoc = getMonkeyPatchedControlledSettings(doc);
    }

    this.changeBuffer.push([event, updatedDoc, fromSync]);

    // Flush right away if we're not buffering
    if (!this.bufferingChanges) {
      await this.flushChanges();
    }
  }

  // ~~~~~~~ //
  // Helpers //
  // ~~~~~~~ //

  /**
   * This function ensures that apiSpec exists for each workspace
   * If the filename on the apiSpec is not set or is the default initialized name
   * It will apply the workspace name to it
   */
  async _applyApiSpecName(workspace: Workspace) {
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
  async _repairBaseEnvironments(workspace: Workspace) {
    const baseEnvironments = await this.find<Environment>(models.environment.type, {
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
      const subEnvironments = await this.find<Environment>(models.environment.type, {
        parentId: baseEnvironment._id,
      });

      for (const subEnvironment of subEnvironments) {
        await docUpdate(this, subEnvironment, {
          parentId: chosenBase._id,
        });
      }

      // Remove unnecessary base env
      await this.remove(baseEnvironment);
    }

    // Update remaining base env
    await this.update(chosenBase);
    console.log(`[fix] Merged ${baseEnvironments.length} base environments under ${workspace.name}`);
  }

  /**
   * This function repairs workspaces that have multiple cookie jars. Since a workspace
   * can only have one, this function walks over all jars and merges them and their cookies
   * together.
   */
  async _fixMultipleCookieJars(workspace: Workspace) {
    const cookieJars = await this.find<CookieJar>(models.cookieJar.type, {
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
      await this.remove(cookieJar);
    }

    // Update remaining jar
    await this.update(chosenJar);
    console.log(`[fix] Merged ${cookieJars.length} cookie jars under ${workspace.name}`);
  }

  // Append .git to old git URIs to mimic previous isomorphic-git behaviour
  async _fixOldGitURIs(doc: GitRepository) {
    if (!doc.uriNeedsMigration) {
      return;
    }

    if (!doc.uri.endsWith('.git')) {
      doc.uri += '.git';
    }

    doc.uriNeedsMigration = false;
    await this.update(doc);
    console.log(`[fix] Fixed git URI for ${doc._id}`);
  }
}
