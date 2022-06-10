import type { BaseModel } from '../models/index';
import { type Query, ChangeListener, ChangeType, Database, DatabaseCommon, docCreate, docUpdate, ModelQuery, Operation, Sort } from './dbtypes';

export { Query };

class NullDatabase implements Database {
  all<T extends BaseModel = BaseModel>(): Promise<T[]> {
    throw new Error('Database not initialized.');
  }

  batchModifyDocs(): Promise<void> {
    throw new Error('Database not initialized.');
  }

  bufferChanges(): Promise<number> {
    throw new Error('Database not initialized.');
  }

  bufferChangesIndefinitely(): Promise<number> {
    throw new Error('Database not initialized.');
  }

  count(): Promise<number> {
    throw new Error('Database not initialized.');
  }

  duplicate<T extends BaseModel = BaseModel>(): Promise<T> {
    throw new Error('Database not initialized.');
  }

  find<T extends BaseModel = BaseModel>(): Promise<T[]> {
    throw new Error('Database not initialized.');
  }

  findMostRecentlyModified<T extends BaseModel = BaseModel>(): Promise<T[]> {
    throw new Error('Database not initialized.');
  }

  flushChanges(): Promise<void> {
    throw new Error('Database not initialized.');
  }

  get<T extends BaseModel = BaseModel>(): Promise<T | null> {
    throw new Error('Database not initialized.');
  }

  getMostRecentlyModified<T extends BaseModel = BaseModel>(): Promise<T | null> {
    throw new Error('Database not initialized.');
  }

  getWhere<T extends BaseModel = BaseModel>(): Promise<T | null> {
    throw new Error('Database not initialized.');
  }

  insert<T extends BaseModel = BaseModel>(): Promise<T> {
    throw new Error('Database not initialized.');
  }

  remove(): Promise<void> {
    throw new Error('Database not initialized.');
  }

  removeWhere(): Promise<void> {
    throw new Error('Database not initialized.');
  }

  unsafeRemove(): Promise<void> {
    throw new Error('Database not initialized.');
  }

  update<T extends BaseModel = BaseModel>(): Promise<T> {
    throw new Error('Database not initialized.');
  }

  upsert<T extends BaseModel = BaseModel>(): Promise<T> {
    throw new Error('Database not initialized.');
  }

  withAncestors<T extends BaseModel = BaseModel>(): Promise<T[]> {
    throw new Error('Database not initialized.');
  }

  withDescendants(): Promise<BaseModel[]> {
    throw new Error('Database not initialized.');
  }

  onChange() {
  }

  offChange() {
  }
}

class DatabaseWrapper extends DatabaseCommon {
  readonly CHANGE_INSERT = ChangeType.INSERT;
  readonly CHANGE_UPDATE = ChangeType.UPDATE;
  readonly CHANGE_REMOVE = ChangeType.REMOVE;

  constructor(private impl: Database) {
    super();
  }

  setImplementation(impl: Database) {
    for (const callback of this.changeListeners) {
      this.impl.offChange(callback);
    }

    this.impl = impl;

    for (const callback of this.changeListeners) {
      this.impl.onChange(callback);
    }
  }

  all<T extends BaseModel>(type: string): Promise<T[]> {
    return this.impl.all(type);
  }

  batchModifyDocs(op: Operation): Promise<void> {
    return this.impl.batchModifyDocs(op);
  }

  /** buffers database changes and returns a buffer id */
  bufferChanges(millis?: number): Promise<number> {
    return this.impl.bufferChanges(millis);
  }

  /** buffers database changes and returns a buffer id */
  bufferChangesIndefinitely(): Promise<number> {
    return this.impl.bufferChangesIndefinitely();
  }

  count(type: string, query?: Query): Promise<number> {
    return this.impl.count(type, query);
  }

  docCreate<T extends BaseModel>(type: string, ...patches: Partial<T>[]): Promise<T> {
    return docCreate<T>(this.impl, type, ...patches);
  }

  docUpdate<T extends BaseModel>(originalDoc: T, ...patches: Partial<T>[]) {
    return docUpdate<T>(this.impl, originalDoc, ...patches);
  }

  duplicate<T extends BaseModel>(originalDoc: T, patch: Partial<T> = {}): Promise<T> {
    return this.impl.duplicate(originalDoc, patch);
  }

  find<T extends BaseModel>(type: string, query?: Query | string, sort?: Sort): Promise<T[]> {
    return this.impl.find(type, query, sort);
  }

  findMostRecentlyModified<T extends BaseModel>(type: string, query?: Query, limit?: number | null): Promise<T[]> {
    return this.impl.findMostRecentlyModified(type, query, limit);
  }

  flushChanges(id?: number, fake?: boolean): Promise<void> {
    return this.impl.flushChanges(id, fake);
  }

  get<T extends BaseModel>(type: string, id?: string): Promise<T | null> {
    return this.impl.get(type, id) as Promise<T | null>;
  }

  getMostRecentlyModified<T extends BaseModel>(type: string, query?: Query): Promise<T | null> {
    return this.impl.getMostRecentlyModified(type, query) as Promise<T | null>;
  }

  getWhere<T extends BaseModel>(type: string, query: ModelQuery<T> | Query): Promise<T | null> {
    return this.impl.getWhere(type, query) as Promise<T | null>;
  }

  insert<T extends BaseModel>(doc: T, fromSync?: boolean, initializeModel?: boolean): Promise<T> {
    return this.impl.insert(doc, fromSync, initializeModel);
  }

  remove<T extends BaseModel>(doc: T, fromSync?: boolean): Promise<void> {
    return this.impl.remove(doc, fromSync);
  }

  removeWhere(type: string, query: Query): Promise<void> {
    return this.impl.removeWhere(type, query);
  }

  unsafeRemove<T extends BaseModel>(doc: T, fromSync?: boolean): Promise<void> {
    return this.impl.unsafeRemove(doc, fromSync);
  }

  update<T extends BaseModel>(doc: T, fromSync?: boolean): Promise<T> {
    return this.impl.update(doc, fromSync);
  }

  upsert<T extends BaseModel>(doc: T, fromSync?: boolean): Promise<T> {
    return this.impl.upsert(doc, fromSync);
  }

  withAncestors<T extends BaseModel>(doc: T | null, types?: string[]): Promise<T[]> {
    return this.impl.withAncestors(doc, types);
  }

  withDescendants<T extends BaseModel>(doc: T | null, stopType?: string | null): Promise<BaseModel[]> {
    return this.impl.withDescendants(doc, stopType);
  }

  onChange(callback: ChangeListener) {
    super.onChange(callback);
    return this.impl.onChange(callback);
  }

  offChange(callback: ChangeListener) {
    super.offChange(callback);
    return this.impl.offChange(callback);
  }

  clearListeners() {
    for (const callback of this.changeListeners) {
      this.offChange(callback);
    }
  }
}

export const database = new DatabaseWrapper(new NullDatabase);
