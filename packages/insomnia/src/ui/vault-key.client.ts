import * as srp from '@getinsomnia/srp-js';
import { services } from 'insomnia-data';

import { base64encode, saveVaultKeyIfNecessary } from '~/common/utils/vault';

const { generateAES256Key, getRandomHex } = srp;

export const LOCAL_VAULT_ACCOUNT_ID = 'local';

export const saveVaultKey = async (vaultKey: string) => {
  const encryptedVaultKey = await window.main.secretStorage.encryptString(vaultKey);
  await services.userSession.update({ vaultKey: encryptedVaultKey });
  await saveVaultKeyIfNecessary(LOCAL_VAULT_ACCOUNT_ID, vaultKey);
};

export const createVaultKey = async () => {
  const vaultSalt = await getRandomHex();
  const key = base64encode(JSON.stringify(await generateAES256Key()));
  await services.userSession.update({ vaultSalt });
  await saveVaultKey(key);
  return key;
};
