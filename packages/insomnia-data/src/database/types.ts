// Database interfaces and types for IoC pattern
// This file defines the abstract interface that different database implementations must adhere to.

import type { AllTypes, BaseModel } from '../models/types';

// Avoid import nedb here to prevent it injecting the node types into renderer process
export interface DataStoreOptions {
  filename?: string;
  timestampData?: boolean;
  inMemoryOnly?: boolean;
  autoload?: boolean;
  onload?(error: Error | null): any;
  beforeDeserialization?(line: string): string | Promise<string>;
  afterSerialization?(line: string): string | Promise<string>;
  corruptAlertThreshold?: number;
  compareStrings?(a: string, b: string): number;
  modes?: { fileMode: number; dirMode: number };
}

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

export type ChangeBufferEvent<T extends BaseModel = BaseModel> = [event: ChangeType, doc: T, patches: Partial<T>[]];

export type ChangeListener = (changes: ChangeBufferEvent[]) => void;

/**
 * Database interface for IoC pattern.
 * Main process uses NeDBDatabaseImpl, renderer uses BridgeDatabaseImpl.
 */
export interface IDatabase<O = DataStoreOptions> {
  /**
   * Batch modify documents (upsert and remove)
   */
  batchModifyDocs(operation: Operation): Promise<void>;

  /**
   * Buffer database changes and return a buffer id.
   * Auto-flushes after specified milliseconds.
   */
  bufferChanges(millis?: number): Promise<number>;

  /**
   * Buffer database changes indefinitely until manual flush.
   */
  bufferChangesIndefinitely(): Promise<number>;

  /**
   * Count documents matching query.
   */
  count<T extends BaseModel>(type: AllTypes, query?: Query<T>): Promise<number>;

  /**
   * Create a new document with the given patches.
   */
  docCreate<T extends BaseModel>(type: AllTypes, ...patches: Partial<T>[]): Promise<T>;

  /**
   * Update an existing document with the given patches.
   */
  docUpdate<T extends BaseModel>(originalDoc: T, ...patches: Partial<T>[]): Promise<T>;

  /**
   * Duplicate a document and its descendants recursively.
   */
  duplicate<T extends BaseModel>(originalDoc: T, patch?: Partial<T>): Promise<T>;

  /**
   * Find documents matching query.
   */
  find<T extends BaseModel>(
    type: AllTypes,
    query?: Query<T> | string,
    sort?: Record<string, any>,
    limit?: number,
  ): Promise<T[]>;

  /**
   * Find one document matching query.
   */
  findOne<T extends BaseModel>(
    type: AllTypes,
    query?: Query<T> | string,
    sort?: Record<string, any>,
  ): Promise<T | undefined>;

  /**
   * Flush buffered changes and trigger all change listeners.
   */
  flushChanges(id?: number, fake?: boolean): Promise<void>;

  /**
   * Initialize the database.
   */
  init(config?: O, forceReset?: boolean): Promise<void>;

  /**
   * Insert a new document.
   */
  insert<T extends BaseModel>(doc: T): Promise<T>;

  /**
   * Register a change listener.
   */
  onChange(callback: ChangeListener): void;

  /**
   * Remove a document and its descendants.
   */
  remove<T extends BaseModel>(doc: T): Promise<void>;

  /**
   * Remove documents matching query.
   */
  removeWhere<T extends BaseModel>(type: AllTypes, query: Query<T>): Promise<void>;

  /**
   * Remove a document without removing its children (unsafe).
   */
  unsafeRemove<T extends BaseModel>(doc: T): Promise<void>;

  /**
   * Update a document.
   */
  update<T extends BaseModel>(doc: T, patches?: Partial<T>[]): Promise<T>;

  /**
   * Get all ancestors of a document including the original.
   */
  withAncestors<T extends BaseModel>(doc: T | undefined, types?: AllTypes[]): Promise<T[]>;

  /**
   * Get a document and its descendants.
   * Note: Returns BaseModel[] because descendants can be of any type.
   */
  getWithDescendants<T extends BaseModel>(doc: T, types?: AllTypes[]): Promise<BaseModel[]>;
}
