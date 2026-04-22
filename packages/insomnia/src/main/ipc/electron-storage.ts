import { getElectronStorage } from '../electron-storage';
import { ipcMainHandle } from './electron';

export interface electronStorageBridgeAPI {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

function validateElectronStorageKey(key: string): string {
  if (!key || key === '.' || key === '..' || key.includes('/') || key.includes('\\') || key.includes('\0')) {
    throw new Error('Invalid electron storage key');
  }

  return key;
}

export function registerElectronStorageHandlers() {
  ipcMainHandle('electronStorage.getItem', (_, key: string) => {
    const storageKey = validateElectronStorageKey(key);
    const storage = getElectronStorage();
    const value = storage.getItem<string>(storageKey);
    return value ?? null;
  });

  ipcMainHandle('electronStorage.setItem', (_, key: string, value: string) => {
    const storageKey = validateElectronStorageKey(key);
    const storage = getElectronStorage();
    storage.setItem(storageKey, value);
  });
}
