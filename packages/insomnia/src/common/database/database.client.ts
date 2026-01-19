// Bridge Database implementation for renderer process
// Uses window.database.invoke API exposed by contextBridge from preload

import type { IDatabase, Operation, Query } from '~/common/database/types';
import type { AllTypes, BaseModel } from '~/models/index';

/**
 * Bridge database implementation for renderer process.
 * Uses window.database.invoke() API exposed by contextBridge in preload.
 */
export const database: IDatabase = {
  batchModifyDocs: async function (operation: Operation) {
    return window.database.invoke<void>('batchModifyDocs', operation);
  },

  bufferChanges: async function (millis = 1000) {
    return window.database.invoke<number>('bufferChanges', millis);
  },

  bufferChangesIndefinitely: async function () {
    return window.database.invoke<number>('bufferChangesIndefinitely');
  },

  count: async function <T extends BaseModel>(type: AllTypes, query: Query<T> = {}) {
    return window.database.invoke<number>('count', type, query);
  },

  docCreate: async <T extends BaseModel>(type: AllTypes, ...patches: Partial<T>[]) => {
    return window.database.invoke<T>('docCreate', type, ...patches);
  },

  docUpdate: async <T extends BaseModel>(originalDoc: T, ...patches: Partial<T>[]) => {
    return window.database.invoke<T>('docUpdate', originalDoc, ...patches);
  },

  duplicate: async function <T extends BaseModel>(originalDoc: T, patch: Partial<T> = {}) {
    return window.database.invoke<T>('duplicate', originalDoc, patch);
  },

  find: async function <T extends BaseModel>(
    type: AllTypes,
    query: Query<T> | string = {},
    sort: Record<string, any> = { created: 1 },
    limit = 0,
  ): Promise<T[]> {
    return window.database.invoke<T[]>('find', type, query, sort, limit);
  },

  findOne: async function <T extends BaseModel>(
    type: AllTypes,
    query: Query<T> | string = {},
    sort: Record<string, any> = { created: 1 },
  ): Promise<T | undefined> {
    return window.database.invoke<T | undefined>('findOne', type, query, sort);
  },

  flushChanges: async function (id = 0, fake = false) {
    return window.database.invoke<void>('flushChanges', id, fake);
  },

  init: async () => {
    // No-op for renderer process - main process handles initialization
  },

  insert: async function <T extends BaseModel>(doc: T) {
    return window.database.invoke<T>('insert', doc);
  },

  onChange: () => {
    // No-op for renderer - change listeners are handled via IPC
  },

  remove: async function <T extends BaseModel>(doc: T) {
    return window.database.invoke<void>('remove', doc);
  },

  removeWhere: async function <T extends BaseModel>(type: AllTypes, query: Query<T>) {
    return window.database.invoke<void>('removeWhere', type, query);
  },

  unsafeRemove: async function <T extends BaseModel>(doc: T) {
    return window.database.invoke<void>('unsafeRemove', doc);
  },

  update: async function <T extends BaseModel>(doc: T, patches: Partial<T>[] = []) {
    return window.database.invoke<T>('update', doc, patches);
  },

  withAncestors: async function <T extends BaseModel>(doc: T | undefined, types: AllTypes[] = []) {
    return window.database.invoke<T[]>('withAncestors', doc, types);
  },

  getWithDescendants: async function <T extends BaseModel>(doc: T, types: AllTypes[] = []) {
    return window.database.invoke<BaseModel[]>('getWithDescendants', doc, types);
  },
};
