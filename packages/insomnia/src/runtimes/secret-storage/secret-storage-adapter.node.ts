// Node adapters delegate to IPC handlers (which are main-process-specific).
// This intentional cross-boundary pattern works because esbuild aliases
// this file in the renderer build, allowing the same shared code to work
// in both contexts via different runtime adapters.
import {
  decryptString as decryptStringSync,
  deleteSecret as deleteSecretAsync,
  encryptString as encryptStringSync,
  getSecret as getSecretAsync,
  setSecret as setSecretAsync,
} from '../../main/ipc/secret-storage';

export const setSecret = setSecretAsync;
export const getSecret = getSecretAsync;
export const deleteSecret = deleteSecretAsync;
export const encryptString = (raw: string) => Promise.resolve(encryptStringSync(raw));
export const decryptString = (cipherText: string) => Promise.resolve(decryptStringSync(cipherText));
