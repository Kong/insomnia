import { type Database, type DBItem } from 'insomnia-storage';

import { types } from '~/models';
import type { DatabaseBuckets } from '~/models/db';

export function databaseFactory<T extends DBItem>(): DatabaseBuckets {
  class RendererDBClient<T extends DBItem> implements Database<T> {
    constructor(private options: { type: string }) {}

    create: Database<T>['create'] = (...args) => {
      return window.database.invoke<T>('create', this.options.type, ...args);
    };

    update: Database<T>['update'] = (...args) => {
      return window.database.invoke<void>('update', this.options.type, ...args);
    };

    remove: Database<T>['remove'] = (...args) => {
      return window.database.invoke<void>('remove', this.options.type, ...args);
    };

    find: Database<T>['find'] = (...args) => {
      return window.database.invoke<T[]>('find', this.options.type, ...args);
    };

    findOne: Database<T>['findOne'] = (...args) => {
      return window.database.invoke<T | null>('findOne', this.options.type, ...args);
    };

    count: Database<T>['count'] = (...args) => {
      return window.database.invoke<number>('count', this.options.type, ...args);
    };
  }

  const databaseBuckets: DatabaseBuckets = {} as DatabaseBuckets;
  types().forEach(bucketName => {
    // @ts-expect-error -- mapping unsoundness
    databaseBuckets[bucketName] = new RendererDBClient<T>({ type: bucketName });
  });
  return databaseBuckets;
}
