import electron from 'electron';
import { type Database, type DBItem } from 'insomnia-storage';
import { v4 as uuidv4 } from 'uuid';

const nedbMap = new Map<string, Database<DBItem>>();

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

export function databaseFactory<T extends DBItem>(type: string): Database<T> {
  if (nedbMap.has(type)) {
    return nedbMap.get(type) as Database<T>;
  }

  const db = new RendererDBClient<T>({
    type,
  });
  nedbMap.set(type, db);
  return db;
}
