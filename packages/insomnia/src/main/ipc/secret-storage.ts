import { safeStorage } from 'electron';

import ElectronStorage from '../electron-storage';
import { initElectronStorage } from '../window-utils';
import { ipcMainHandle } from './electron';

export interface secretStorageBridgeAPI {
  setSecret: typeof setSecret;
  getSecret: typeof getSecret;
  deleteSecret: typeof deleteSecret;
  encryptString: (raw: string) => Promise<string>;
  decryptString: (cipherText: string) => Promise<string>;
}

export function registerSecretStorageHandlers() {
  ipcMainHandle('secretStorage.setSecret', (_, key, secret) => setSecret(key, secret));
  ipcMainHandle('secretStorage.getSecret', (_, key) => getSecret(key));
  ipcMainHandle('secretStorage.deleteSecret', (_, key) => deleteSecret(key));
  ipcMainHandle('secretStorage.encryptString', (_, raw) => encryptString(raw));
  ipcMainHandle('secretStorage.decryptString', (_, raw) => decryptString(raw));
}

let electronStorage: ElectronStorage | null = null;

const getElectronStorage = () => {
  if (!electronStorage) {
    electronStorage = initElectronStorage();
  }
  return electronStorage;
};

const setSecret = async (key: string, secret: string) => {
  try {
    const secretStorage = getElectronStorage();
    const encrypted = encryptString(secret);
    secretStorage.setItem(key, encrypted);
  } catch (error) {
    console.error(`Can not save secret ${error.toString()}`);
    return Promise.reject(error);
  }
};

const getSecret = async (key: string) => {
  try {
    const secretStorage = getElectronStorage();
    const encrypted = secretStorage.getItem(key, '');
    return encrypted === '' ? null : decryptString(encrypted);
  } catch (error) {
    console.error(`Can not get secret ${error.toString()}`);
    return Promise.reject(null);
  }
};

const deleteSecret = async (key: string) => {
  try {
    const secretStorage = getElectronStorage();
    secretStorage.deleteItem(key);
  } catch (error) {
    console.error(`Can not delele secret ${error.toString()}`);
    return Promise.reject(error);
  }
};

const encryptString = (raw: string) => {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(raw).toString('hex');
  }
  return raw;
};

const decryptString = (cipherText: string) => {
  const buffer = Buffer.from(cipherText, 'hex');
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(buffer);
    } catch (error) {
      console.error(`Can not decrypt secret ${error.toString()}`);
      return cipherText;
    }
  }
  return cipherText;
};
