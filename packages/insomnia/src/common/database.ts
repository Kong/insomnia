import type { DatabaseHost } from '../main/database';
import type { DatabaseClient } from '../ui/database';
import type { ChangeBufferEvent, ChangeListener, Query } from './dbtypes';

export { Query };

export let database: DatabaseHost | DatabaseClient;

export function setDatabase(db: DatabaseHost | DatabaseClient) {
  database = db;
}

let changeListeners: ChangeListener[] = [];

export function clearChangeListeners() {
  changeListeners = [];
}

export function onChange(callback: ChangeListener) {
  changeListeners.push(callback);
}

export function offChange(callback: ChangeListener) {
  changeListeners = changeListeners.filter(l => l !== callback);
}

export async function notifyChange(changes: ChangeBufferEvent[]) {
  for (const fn of changeListeners) {
    await fn(changes);
  }
}
