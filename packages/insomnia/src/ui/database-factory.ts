import electron from 'electron';
import { type Database, type DBItem } from 'insomnia-storage';
import { v4 as uuidv4 } from 'uuid';

import { types } from '~/models';
import type { DatabaseBuckets } from '~/models/db';

export function databaseFactory<T extends DBItem>(): DatabaseBuckets {
  async function _send<T>(fnName: string, type: string, ...args: any[]) {
    return new Promise<T>((resolve, reject) => {
      const replyChannel = `db.fn.reply:${uuidv4()}`;
      electron.ipcRenderer.send('db.fn.new', fnName, replyChannel, type, ...args);
      electron.ipcRenderer.once(replyChannel, (_e, err, result: T) => (err ? reject(err) : resolve(result)));
    });
  }

  class RendererDBClient<T extends DBItem> implements Database<T> {
    constructor(private options: { type: string }) {}
    create: Database<T>['create'] = (...args) => {
      return _send<T>('create', this.options.type, ...args);
    };
    update: Database<T>['update'] = (...args) => {
      return _send<void>('update', this.options.type, ...args);
    };
    remove: Database<T>['remove'] = (...args) => {
      return _send<void>('remove', this.options.type, ...args);
    };
    find: Database<T>['find'] = (...args) => {
      return _send<T[]>('find', this.options.type, ...args);
    };
    findOne: Database<T>['findOne'] = (...args) => {
      return _send<T>('findOne', this.options.type, ...args);
    };
    count: Database<T>['count'] = (...args) => {
      return _send<number>('count', this.options.type, ...args);
    };
  }

  const databaseBuckets: DatabaseBuckets = {} as DatabaseBuckets;
  types().forEach(bucketName => {
    // @ts-expect-error -- mapping unsoundness
    databaseBuckets[bucketName] = new RendererDBClient<T>({ type: bucketName });
  });
  return databaseBuckets;
}
