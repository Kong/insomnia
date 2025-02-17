import { settings } from '../models';

export const base64encode = (input: string | JsonWebKey) => {
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
  return Buffer.from(inputStr, 'utf-8').toString('base64');
};

export const base64decode = (base64Str: string, toObject: boolean) => {
  try {
    const decodedStr = Buffer.from(base64Str, 'base64').toString('utf-8');
    if (toObject) {
      return JSON.parse(decodedStr);
    }
    return decodedStr;
  } catch (error) {
    console.error(`failed to base64 decode string ${base64Str}`);
  }
  return base64Str;
};

export const decryptVaultKeyFromSession = async (vaultKey: string, toJsonWebKey: boolean) => {
  if (vaultKey) {
    const decryptedVaultKey = await window.main.secretStorage.decryptString(vaultKey);
    if (toJsonWebKey) {
      return base64decode(decryptedVaultKey, true);
    };
    return decryptedVaultKey;
  }
  return '';
};

const getVaultSecretKey = (accountId: string) => `vault_${accountId}`;

export const saveVaultKeyIfNecessary = async (accountId: string, vaultKey: string) => {
  const userSetting = await settings.getOrCreate();
  const { saveVaultKeyLocally } = userSetting;
  if (saveVaultKeyLocally) {
    await window.main.secretStorage.setSecret(getVaultSecretKey(accountId), vaultKey);
  }
};

export const getVaultKeyFromStorage = async (accountId: string) => {
  const savedVaultKey = await window.main.secretStorage.getSecret(getVaultSecretKey(accountId));
  return savedVaultKey;
};

export const deleteVaultKeyFromStorage = async (accountId: string) => {
  await window.main.secretStorage.deleteSecret(getVaultSecretKey(accountId));
};
