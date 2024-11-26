import { safeStorage } from 'electron';
import keytar from 'keytar';

import { getProductName } from '../../common/constants';
import { ipcMainHandle } from './electron';

const serviceName = `${getProductName()} vault`;
export interface keyChainBridgeAPI {
  saveToKeyChain: typeof saveToKeyChain;
  retrieveFromKeyChain: typeof retrieveFromKeyChain;
  deleteFromKeyChian: typeof deleteFromKeyChian;
  encryptString: (raw: string) => Promise<string>;
  decryptString: (cipherText: string) => Promise<string>;
}

export function registergKeyChainHandlers() {
  ipcMainHandle('keyChain.saveToKeyChain', (_, accountId, key) => saveToKeyChain(accountId, key));
  ipcMainHandle('keyChain.retrieveFromKeyChain', (_, accountId) => retrieveFromKeyChain(accountId));
  ipcMainHandle('keyChain.deleteFromKeyChain', (_, accountId) => deleteFromKeyChian(accountId));
  ipcMainHandle('keyChain.encryptString', (_, raw) => encryptString(raw));
  ipcMainHandle('keyChain.decryptString', (_, raw) => decryptString(raw));
}

const saveToKeyChain = async (accountId: string, key: string) => {
  try {
    await keytar.setPassword(serviceName, accountId, key);
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(key);
    }
    return key;
  } catch (error) {
    console.error(`Can not save key to keychain ${error.toString()}`);
    return Promise.reject(error);
  }
};

const retrieveFromKeyChain = async (accountId: string) => {
  try {
    const password = await keytar.getPassword(serviceName, accountId);
    return password;
  } catch (error) {
    console.error(`Can not get key from keychain ${error.toString()}`);
    return Promise.reject(error);
  }
};

const deleteFromKeyChian = async (accountId: string) => {
  try {
    await keytar.deletePassword(serviceName, accountId);
  } catch (error) {
    console.error(`Can not delele key ${error.toString()}`);
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
    return safeStorage.decryptString(buffer);
  }
  return cipherText;
};
