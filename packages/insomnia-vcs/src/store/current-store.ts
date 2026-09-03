import type { BaseDriver } from './drivers/base';
import compress from './hooks/compress';
import Store from './index';

let store: Store | null = null;

export function configureStore(driver: BaseDriver): void {
  store = new Store(driver, [compress]);
}

export function getStore(): Store {
  if (!store) {
    throw new Error('VCS store has not been configured. Call configureStore() first.');
  }

  return store;
}
