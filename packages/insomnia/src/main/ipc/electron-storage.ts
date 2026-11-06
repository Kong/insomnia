import { getElectronStorage } from '../electron-storage';
import { ipcMainHandle } from './electron';
import { assertStorageKeyAllowedForRenderer } from './reserved-storage-keys';

export interface electronStorageBridgeAPI {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

export function registerElectronStorageHandlers() {
  ipcMainHandle('electronStorage.getItem', (_, key: string) => {
    assertStorageKeyAllowedForRenderer(key);
    const storage = getElectronStorage();
    const value = storage.getItem<string>(key);
    return value ?? null;
  });

  ipcMainHandle('electronStorage.setItem', (_, key: string, value: string) => {
    assertStorageKeyAllowedForRenderer(key);
    const storage = getElectronStorage();
    storage.setItem(key, value);
  });
}
