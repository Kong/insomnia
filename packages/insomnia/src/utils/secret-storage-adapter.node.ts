import { deleteSecret as deleteSecretImpl, getSecret as getSecretImpl, setSecret as setSecretImpl, encryptString as encryptStringImpl, decryptString as decryptStringImpl } from '../main/ipc/secret-storage';

export const setSecret = setSecretImpl;
export const getSecret = getSecretImpl;
export const deleteSecret = deleteSecretImpl;
export const encryptString = (raw: string) => Promise.resolve(encryptStringImpl(raw));
export const decryptString = (cipherText: string) => Promise.resolve(decryptStringImpl(cipherText));
