import keytar from 'keytar';

import { ipcMainHandle } from './electron';

const serviceName = 'Insomnia Vault';
export interface keyChainBridgeAPI {
  saveToKeyChain: typeof saveToKeyChain;
  retrieveFromKeyChain: typeof retrieveFromKeyChain;
  deleteFromKeyChian: typeof deleteFromKeyChian;
}

export function registergKeyChainHandlers() {
  ipcMainHandle('keyChain.saveToKeyChain', (_, accountId, key) => saveToKeyChain(accountId, key));
  ipcMainHandle('keyChain.retrieveFromKeyChain', (_, accountId) => retrieveFromKeyChain(accountId));
  ipcMainHandle('keyChain.deleteFromKeyChain', (_, accountId) => deleteFromKeyChian(accountId));
}

const saveToKeyChain = async (accountId: string, key: string) => {
  try {
    await keytar.setPassword(serviceName, accountId, key);
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
