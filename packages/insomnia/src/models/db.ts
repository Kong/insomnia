import type { Database, DBItem } from 'insomnia-storage';

let factory: <T extends DBItem>(type: string) => Database<T> = (_type: string) => {
  throw new Error('Database factory not initialized');
};
export function configureModel(_factory: <T extends DBItem>(type: string) => Database<T>) {
  factory = _factory;
}

export const createDatabaseBucket = <T extends DBItem>(type: string): Database<T> => {
  return {
    create: (...args) => factory<T>(type).create(...args),
    update: (...args) => factory<T>(type).update(...args),
    remove: (...args) => factory<T>(type).remove(...args),
    find: (...args) => factory<T>(type).find(...args),
    findOne: (...args) => factory<T>(type).findOne(...args),
    count: (...args) => factory<T>(type).count(...args),
  };
};
