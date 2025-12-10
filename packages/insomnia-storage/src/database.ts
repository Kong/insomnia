interface SpecificQuery {
  $gt?: number;
  $in?: (string | null)[];
  $nin?: string[];
  $ne?: string | null;
}

export interface DBItem {
  _id: string;
}

export type Query<T extends DBItem = DBItem> = {
  [key in keyof T]?: string | SpecificQuery | null | undefined;
};

export interface Database<T extends DBItem = DBItem> {
  create(doc: T): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<void>;
  remove(query: string | Query<T>): Promise<void>;
  find(query?: string | Query<T>, sort?: Record<string, 1 | -1>, limit?: number): Promise<T[]>;
  findOne(query?: string | Query<T>, sort?: Record<string, 1 | -1>): Promise<T | null>;
  count(query?: Query<T>): Promise<number>;
}
