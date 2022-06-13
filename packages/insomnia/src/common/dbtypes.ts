import { BaseModel, initModel } from '../models';

export interface Query {
  _id?: string | SpecificQuery;
  parentId?: string | null;
  remoteId?: string | null;
  plugin?: string;
  key?: string;
  environmentId?: string | null;
  protoFileId?: string;
}

export type Sort = Record<string, any>;

export interface Operation {
  upsert?: BaseModel[];
  remove?: BaseModel[];
}

export interface SpecificQuery {
  $gt?: number;
  $in?: string[];
  $nin?: string[];
}

export enum ChangeType {
  INSERT = 'insert',
  UPDATE = 'update',
  REMOVE = 'remove',
}

export type ModelQuery<T extends BaseModel> = Partial<Record<keyof T, SpecificQuery>>;

export type ChangeBufferEvent = [
  event: string,
  doc: BaseModel,
  fromSync: boolean
];

export type ChangeListener = (changes: ChangeBufferEvent[]) => Promise<void> | void;

export interface Database {
  all<T extends BaseModel = BaseModel>(type: string): Promise<T[]>;
  batchModifyDocs(op: Operation): Promise<void>;
  bufferChanges(millis?: number): Promise<number>;
  bufferChangesIndefinitely(): Promise<number>;
  count(type: string, query?: Query): Promise<number>;
  duplicate<T extends BaseModel = BaseModel>(originalDoc: T, patch?: Partial<T>): Promise<T>;
  find<T extends BaseModel = BaseModel>(type: string, query?: Query | string, sort?: Sort): Promise<T[]>;
  findMostRecentlyModified<T extends BaseModel = BaseModel>(type: string, query?: Query, limit?: number | null): Promise<T[]>;
  flushChanges(id?: number, fake?: boolean): Promise<void>;
  get<T extends BaseModel = BaseModel>(type: string, id?: string): Promise<T | null>;
  getMostRecentlyModified<T extends BaseModel = BaseModel>(type: string, query?: Query): Promise<T | null>;
  getWhere<T extends BaseModel = BaseModel>(type: string, query: ModelQuery<T> | Query): Promise<T | null>;
  insert<T extends BaseModel = BaseModel>(doc: T, fromSync?: boolean, initializeModel?: boolean): Promise<T>;
  remove(doc: BaseModel, fromSync?: boolean): Promise<void>;
  removeWhere(type: string, query: Query): Promise<void>;
  unsafeRemove(doc: BaseModel, fromSync?: boolean): Promise<void>;
  update<T extends BaseModel = BaseModel>(doc: T, fromSync?: boolean): Promise<T>;
  upsert<T extends BaseModel = BaseModel>(doc: T, fromSync?: boolean): Promise<T>;
  withAncestors<T extends BaseModel = BaseModel>(doc: T | null, types?: string[]): Promise<T[]>;
  withDescendants<T extends BaseModel = BaseModel>(doc: T | null, stopType?: string | null): Promise<BaseModel[]>;
}

export class DatabaseCommon {
  readonly CHANGE_INSERT = ChangeType.INSERT;
  readonly CHANGE_UPDATE = ChangeType.UPDATE;
  readonly CHANGE_REMOVE = ChangeType.REMOVE;
}

export async function docCreate<T extends BaseModel>(database: Database, type: string, ...patches: Partial<T>[]): Promise<T> {
  const doc = await initModel<T>(
    type,
    ...patches,
    // Fields that the user can't touch
    {
      type: type,
    },
  );
  return database.insert<T>(doc);
}

export async function docUpdate<T extends BaseModel>(database: Database, originalDoc: T, ...patches: Partial<T>[]) {
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
  return database.update<T>(doc);
}
