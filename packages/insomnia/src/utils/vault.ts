import { services } from 'insomnia-data';

import { getInsomniaVaultKey, PLAYWRIGHT_TEST } from '../common/constants';
import { getRuntime } from '../runtimes';

export const base64encode = (input: string | JsonWebKey) => {
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
  const bytes = new TextEncoder().encode(inputStr);
  let binary = '';
  bytes.forEach(byte => (binary += String.fromCodePoint(byte)));
  return btoa(binary);
};

export function base64decode(base64Str: string, toObject: true): object;
export function base64decode(base64Str: string, toObject: false): string;
export function base64decode(base64Str: string, toObject: boolean): string | object {
  try {
    const decodedStr = new TextDecoder().decode(Uint8Array.from(atob(base64Str), c => c.codePointAt(0) ?? 0));
    if (toObject) {
      return JSON.parse(decodedStr);
    }
    return decodedStr;
  } catch {
    console.error(`failed to base64 decode string ${base64Str}`);
  }
  return base64Str;
}

export function decryptVaultKeyFromSession(vaultKey: string, toJsonWebKey: true): Promise<object>;
export function decryptVaultKeyFromSession(vaultKey: string, toJsonWebKey: false): Promise<string>;
export async function decryptVaultKeyFromSession(vaultKey: string, toJsonWebKey: boolean): Promise<string | object> {
  if (PLAYWRIGHT_TEST) {
    const testVaultKey = getInsomniaVaultKey() || '';
    if (testVaultKey) {
      // return vault key from environment variable directly when running playwright tests
      return toJsonWebKey ? base64decode(testVaultKey, true) : testVaultKey;
    }
  }
  if (vaultKey) {
    const decryptedVaultKey = await getRuntime().secretStorage.decryptString(vaultKey);
    if (toJsonWebKey) {
      return base64decode(decryptedVaultKey, true);
    }
    return decryptedVaultKey;
  }
  return '';
}

const getVaultSecretKey = (accountId: string) => `vault_${accountId}`;

export const saveVaultKeyIfNecessary = async (accountId: string, vaultKey: string) => {
  const userSetting = await services.settings.getOrCreate();
  const { saveVaultKeyLocally } = userSetting;
  if (saveVaultKeyLocally) {
    await getRuntime().secretStorage.setSecret(getVaultSecretKey(accountId), vaultKey);
  }
};

export const getVaultKeyFromStorage = async (accountId: string) => {
  const savedVaultKey = await getRuntime().secretStorage.getSecret(getVaultSecretKey(accountId));
  return savedVaultKey;
};

export const deleteVaultKeyFromStorage = async (accountId: string) => {
  await getRuntime().secretStorage.deleteSecret(getVaultSecretKey(accountId));
};
