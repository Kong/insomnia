import { getElectronStorage } from '../electron-storage';
import { ipcMainHandle } from './electron';

export interface electronStorageBridgeAPI {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

export function registerElectronStorageHandlers() {
  ipcMainHandle('electronStorage.getItem', (_, key: string) => {
    const storage = getElectronStorage();
    const value = storage.getItem<string>(key);
    return value ?? null;
  });

  ipcMainHandle('electronStorage.setItem', (_, key: string, value: string) => {
    const storage = getElectronStorage();
    storage.setItem(key, value);
  });
}
