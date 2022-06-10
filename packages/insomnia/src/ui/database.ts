import electron from 'electron';
import { v4 as uuidv4 } from 'uuid';

import { database } from '../common/database';
import { ChangeBufferEvent, Database, DatabaseCommon, Operation, Query, Sort, SpecificQuery } from '../common/dbtypes';
import { BaseModel } from '../models';

export class DatabaseClient extends DatabaseCommon implements Database {
  private constructor() {
    super();

    electron.ipcRenderer.on('db.changes', async (_e, changes: ChangeBufferEvent[]) => {
      for (const fn of this.changeListeners) {
        await fn(changes);
      }
    });

    console.log('[db] Initialized DB client');
  }

  static init() {
    database.setImplementation(new DatabaseClient);
  }

  all<T extends BaseModel = BaseModel>(type: string): Promise<T[]> {
    return this._send('all', type) as Promise<T[]>;
  }

  batchModifyDocs(op: Operation): Promise<void> {
    return this._send('batchModifyDocs', op);
  }

  bufferChanges(millis?: number): Promise<number> {
    return this._send('bufferChanges', millis);
  }

  bufferChangesIndefinitely(): Promise<number> {
    return this._send('bufferChangesIndefinitely');
  }

  count(type: string, query?: Query): Promise<number> {
    return this._send('count', type, query);
  }

  duplicate<T extends BaseModel = BaseModel>(originalDoc: T, patch?: Partial<T>): Promise<T> {
    return this._send('duplicate', originalDoc, patch) as Promise<T>;
  }

  find<T extends BaseModel = BaseModel>(type: string, query?: string | Query, sort?: Sort): Promise<T[]> {
    return this._send('find', type, query, sort) as Promise<T[]>;
  }

  findMostRecentlyModified<T extends BaseModel = BaseModel>(type: string, query?: Query, limit?: number | null): Promise<T[]> {
    return this._send('findMostRecentlyModified', type, query, limit) as Promise<T[]>;
  }

  flushChanges(id?: number, fake?: boolean): Promise<void> {
    return this._send('flushChanges', id, fake);
  }

  get<T extends BaseModel = BaseModel>(type: string, id?: string): Promise<T | null> {
    return this._send('get', type, id) as Promise<T | null>;
  }

  getMostRecentlyModified<T extends BaseModel = BaseModel>(type: string, query?: Query): Promise<T | null> {
    return this._send('getMostRecentlyModified', type, query) as Promise<T | null>;
  }

  getWhere<T extends BaseModel = BaseModel>(type: string, query: Query | Partial<Record<keyof T, SpecificQuery>>): Promise<T | null> {
    return this._send('getWhere', type, query) as Promise<T | null>;
  }

  insert<T extends BaseModel = BaseModel>(doc: T, fromSync?: boolean, initializeModel?: boolean): Promise<T> {
    return this._send('insert', doc, fromSync, initializeModel) as Promise<T>;
  }

  remove(doc: BaseModel, fromSync?: boolean): Promise<void> {
    return this._send('remove', doc, fromSync);
  }

  removeWhere(type: string, query: Query): Promise<void> {
    return this._send('removeWhere', type, query);
  }

  unsafeRemove(doc: BaseModel, fromSync?: boolean): Promise<void> {
    return this._send('unsafeRemove', doc, fromSync);
  }

  update<T extends BaseModel = BaseModel>(doc: T, fromSync?: boolean): Promise<T> {
    return this._send('update', doc, fromSync) as Promise<T>;
  }

  upsert<T extends BaseModel = BaseModel>(doc: T, fromSync?: boolean): Promise<T> {
    return this._send('upsert', doc, fromSync) as Promise<T>;
  }

  withAncestors<T extends BaseModel = BaseModel>(doc: T | null, types?: string[]): Promise<T[]> {
    return this._send('withAncestors', doc, types) as Promise<T[]>;
  }

  withDescendants<T extends BaseModel = BaseModel>(doc: T | null, stopType?: string | null): Promise<BaseModel[]> {
    return this._send('withDescendants', doc, stopType) as Promise<T[]>;
  }

  // ~~~~~~~ //
  // Helpers //
  // ~~~~~~~ //
  private _send<T extends keyof Database, Fn extends Database[T]>(fnName: T, ...args: Parameters<Fn>): Promise<Awaited<ReturnType<Fn>>> {
    return electron.ipcRenderer.invoke('db.fn', fnName, ...args);
  }
}
