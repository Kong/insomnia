import {
  decryptString as decryptStringImpl,
  deleteSecret as deleteSecretImpl,
  encryptString as encryptStringImpl,
  getSecret as getSecretImpl,
  setSecret as setSecretImpl,
} from '../main/ipc/secret-storage';

export const setSecret = setSecretImpl;
export const getSecret = getSecretImpl;
export const deleteSecret = deleteSecretImpl;
export const encryptString = (raw: string) => Promise.resolve(encryptStringImpl(raw));
export const decryptString = (cipherText: string) => Promise.resolve(decryptStringImpl(cipherText));
