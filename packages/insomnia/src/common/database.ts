// This file could be imported by both main and renderer processes, so it should be written in a way that works in both contexts.

/* eslint-disable prefer-rest-params -- don't want to change ...arguments usage for these sensitive functions without more testing */

import type { BaseModel } from '../models/index';

export type Query<T extends BaseModel = BaseModel> = {
  [key in keyof T]?: string | SpecificQuery | null | undefined;
};

type Sort = Record<string, any>;

export interface Operation {
  upsert?: BaseModel[];
  remove?: BaseModel[];
}

export interface SpecificQuery {
  $gt?: number;
  $in?: string[];
  $nin?: string[];
  $ne?: string | null;
}

export type ChangeType = 'insert' | 'update' | 'remove';

export const database =
  process.type === 'browser'
    ? require('../main/database').database
    : {
        // Get all documents of a certain type
        all: async function <T extends BaseModel>(type: string) {
          return _send<T[]>('all', ...arguments);
        },

        batchModifyDocs: async function ({ upsert = [], remove = [] }: Operation) {
          if (db._empty) {
            return _send<void>('batchModifyDocs', ...arguments);
          }
        },

        /** buffers database changes and returns a buffer id, automatically call flushChanges in millis,
         * bufferChanges and flushChanges should be called in pair every time documents changes are made to trigger change listeners */
        bufferChanges: async function (millis = 1000) {
          if (db._empty) {
            return _send<number>('bufferChanges', ...arguments);
          }
        },

        /** buffers database changes and returns a buffer id */
        bufferChangesIndefinitely: async function () {
          if (db._empty) {
            return _send<number>('bufferChangesIndefinitely', ...arguments);
          }
        },

        /** return count num of documents matching query */
        count: async function <T extends BaseModel>(type: string, query: Query<T> = {}) {
          if (db._empty) {
            return _send<number>('count', ...arguments);
          }
        },

        docCreate: async function <T extends BaseModel>(type: string, patches: Patch<T>[]) {
          if (db._empty) {
            return _send<T>('docCreate', ...arguments);
          }
        },

        docUpdate: async function <T extends BaseModel>(originalDoc: T, patches: Patch<T>[]) {
          if (db._empty) {
            return _send<T>('docUpdate', ...arguments);
          }
        },

        /** duplicate doc and its decendents recursively */
        duplicate: async function <T extends BaseModel>(originalDoc: T, patch: Patch<T> = {}) {
          if (db._empty) {
            return _send<T>('duplicate', ...arguments);
          }
        },

        /** find documents matching query */
        find: async function <T extends BaseModel>(
          type: string,
          query: Query<T> | string = {},
          sort: Sort = { created: 1 },
        ) {
          if (db._empty) {
            return _send<T[]>('find', ...arguments);
          }
        },

        findMostRecentlyModified: async function <T extends BaseModel>(
          type: string,
          query: Query<T> = {},
          limit: number | null = null,
        ) {
          if (db._empty) {
            return _send<T[]>('findMostRecentlyModified', ...arguments);
          }
        },

        /** trigger all changeListeners */
        flushChanges: async function (id = 0, fake = false) {
          if (db._empty) {
            return _send<void>('flushChanges', ...arguments);
          }
        },

        /** get the exact document by id */
        get: async function <T extends BaseModel>(type: string, id?: string) {
          if (db._empty) {
            return _send<T>('get', ...arguments);
          }
        },

        getMostRecentlyModified: async function <T extends BaseModel>(type: string, query: Query<T> = {}) {
          if (db._empty) {
            return _send<T>('getMostRecentlyModified', ...arguments);
          }
        },

        /** get the first document matching query */
        getWhere: async function <T extends BaseModel>(type: string, query: Query<T>) {
          if (db._empty) {
            return _send<T>('getWhere', ...arguments);
          }
        },

        /** init in renderer process */
        initClient: async () => {
          window.main.on('db.changes', async (_e, changes) => {
            for (const fn of changeListeners) {
              await fn(changes);
            }
          });
          console.log('[db] Initialized DB client');
        },

        insert: async function <T extends BaseModel>(doc: T, fromSync = false, initializeModel = true) {
          if (db._empty) {
            return _send<T>('insert', ...arguments);
          }
        },

        onChange: (callback: ChangeListener) => {
          changeListeners.push(callback);
        },

        offChange: (callback: ChangeListener) => {
          changeListeners = changeListeners.filter(l => l !== callback);
        },

        /** remove doc and its descendants */
        remove: async function <T extends BaseModel>(doc: T, fromSync = false) {
          if (db._empty) {
            return _send<void>('remove', ...arguments);
          }
        },

        removeWhere: async function <T extends BaseModel>(type: string, query: Query<T>) {
          if (db._empty) {
            return _send<void>('removeWhere', ...arguments);
          }
        },

        /** Removes entries without removing their children */
        unsafeRemove: async function <T extends BaseModel>(doc: T, fromSync = false) {
          if (db._empty) {
            return _send<void>('unsafeRemove', ...arguments);
          }
        },

        update: async function <T extends BaseModel>(doc: T, fromSync = false, patches: Patch<T>[] = []) {
          if (db._empty) {
            return _send<T>('update', ...arguments);
          }
        },

        // TODO(TSCONVERSION) the update method above can now take an upsert property
        upsert: async function <T extends BaseModel>(doc: T, fromSync = false) {
          if (db._empty) {
            return _send<T>('upsert', ...arguments);
          }
        },

        /** get all ancestors of specified types of a document */
        withAncestors: async function <T extends BaseModel>(doc: T | null, types: string[] = allTypes()) {
          if (db._empty) {
            return _send<T[]>('withAncestors', ...arguments);
          }
        },

        /**
         * Get all descendants of a document.
         *
         * This function retrieves all descendant documents of a given document from the database.
         * It performs a recursive search, starting from the provided document and continuing
         * through all child documents, until no more descendants are found or a document of the
         * specified stop type is encountered.
         *
         * @param doc - The document to start the search from. If null, the search starts from the root.
         * @param stopType - An optional type of document to stop the search at. If a document of this type is encountered, its descendants are not included.
         * @param queryTypes - An optional array of document types to query. If not provided, all types are queried.
         * @returns A promise that resolves to an array of all descendant documents.
         */
        withDescendants: async function <T extends BaseModel>(
          doc: T | null,
          stopType: string | null = null,
          queryTypes: string[] = [],
        ): Promise<BaseModel[]> {
          if (db._empty) {
            return _send<BaseModel[]>('withDescendants', ...arguments);
          }
        },
      };

const db = {
  // _empty is true if it's in the renderer process
  _empty: true,
};

// ~~~~~~~ //
// HELPERS //
// ~~~~~~~ //
const allTypes = () => Object.keys(db);

export type ChangeBufferEvent<T extends BaseModel = BaseModel> = [
  event: ChangeType,
  doc: T,
  fromSync: boolean,
  patches: Patch<T>[],
];

type ChangeListener = (changes: ChangeBufferEvent[]) => void;

let changeListeners: ChangeListener[] = [];

// ~~~~~~~~~~~~~~~~~~~ //
// DEFAULT MODEL STUFF //
// ~~~~~~~~~~~~~~~~~~~ //

type Patch<T> = Partial<T>;

// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //
// If you call database.x methods within the render process, you can obtain results by this helper function. In renderer process, db._empty is true.
async function _send<T>(fnName: string, ...args: any[]) {
  return electron.ipcRenderer.invoke('db.fn', fnName, ...args);
}
