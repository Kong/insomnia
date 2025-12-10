import NeDB from '@seald-io/nedb';

import type { Database, DBItem, Query } from '../database';

export class NeDBClient<T extends DBItem = DBItem> implements Database<T> {
  private db: NeDB<T>;
  constructor({ filename, inMemoryOnly = false }: { filename: string; inMemoryOnly?: boolean }) {
    this.db = new NeDB({
      autoload: true,
      corruptAlertThreshold: 0.9,
      filename,
      inMemoryOnly,
    });
  }
  create(value: T) {
    return this.db.insertAsync({ ...value });
  }
  async update(id: string, patches: Partial<T>) {
    await this.db.updateAsync({ _id: id }, { $set: patches }, { upsert: true });
  }
  async remove(query: Query<T> | string) {
    await this.db.removeAsync(query, { multi: true });
  }
  find(query: Query<T> | string = {}, sort: Record<string, 1 | -1> = {}, limit = 0) {
    return this.db.findAsync(query).sort(sort).limit(limit);
  }
  findOne(query: Query<T> | string = {}, sort: Record<string, 1 | -1> = {}) {
    return this.db.findOneAsync(query).sort(sort);
  }
  count(query: Query<T> = {}) {
    return this.db.countAsync(query);
  }
}
