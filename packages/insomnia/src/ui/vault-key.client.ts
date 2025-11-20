import * as srp from '@getinsomnia/srp-js';

import { userSession as sessionModel } from '../models';
import type { UserSession } from '../models/user-session';
import { base64encode, saveVaultKeyIfNecessary } from '../utils/vault';
import { insomniaFetch } from './insomnia-fetch';

const { Buffer, Client, generateAES256Key, getRandomHex, params, srpGenKey } = srp;
interface FetchError {
  error?: string;
  message?: string;
}

export const vaultKeyParams = params[2048];
const vaultKeyRequestBathPath = '/v1/user/vault';

const createVaultKeyRequest = async (sessionId: string, salt: string, verifier: string) =>
  insomniaFetch<FetchError>({
    method: 'POST',
    path: vaultKeyRequestBathPath,
    data: { salt, verifier },
    sessionId,
  }).catch(error => {
    console.error(error);
  });

const resetVaultKeyRequest = async (sessionId: string, salt: string, verifier: string) =>
  insomniaFetch<FetchError>({
    method: 'POST',
    path: `${vaultKeyRequestBathPath}/reset`,
    sessionId,
    data: { salt, verifier },
  }).catch(error => {
    console.error(error);
  });

export const saveVaultKey = async (accountId: string, vaultKey: string) => {
  // save encrypted vault key and vault salt to session
  const encryptedVaultKey = await window.main.secretStorage.encryptString(vaultKey);
  await sessionModel.patch({ vaultKey: encryptedVaultKey });

  await saveVaultKeyIfNecessary(accountId, vaultKey);
};

export const createVaultKey = async (type: 'create' | 'reset' = 'create') => {
  const userSession = await sessionModel.getOrCreate();
  const { accountId, id: sessionId } = userSession;

  const vaultSalt = await getRandomHex();
  const newVaultKey = await generateAES256Key();
  const base64encodedVaultKey = base64encode(JSON.stringify(newVaultKey));

  try {
    // Compute the verifier
    const verifier = srp
      .computeVerifier(
        vaultKeyParams,
        Buffer.from(vaultSalt, 'hex'),
        Buffer.from(accountId, 'utf8'),
        Buffer.from(base64encodedVaultKey, 'base64'),
      )
      .toString('hex');
    // send or reset saltAuth & verifier to server
    if (type === 'create') {
      const response = await createVaultKeyRequest(sessionId, vaultSalt, verifier);
      if (response?.error) {
        return { error: `${response?.error}: ${response?.message}` };
      }
    } else {
      const response = await resetVaultKeyRequest(sessionId, vaultSalt, verifier);
      if (response?.error) {
        return { error: `${response?.error}: ${response?.message}` };
      }
    }

    // save encrypted vault key and vault salt to session
    await sessionModel.patch({ vaultSalt: vaultSalt });
    await saveVaultKey(accountId, base64encodedVaultKey);
    return {
      key: base64encodedVaultKey,
    };
  } catch (error) {
    return { error: error.toString() };
  }
};

export const validateVaultKey = async (session: UserSession, vaultKey: string, vaultSalt: string) => {
  const { id: sessionId, accountId } = session;
  const secret1 = await srpGenKey();
  const srpClient = new Client(
    vaultKeyParams,
    Buffer.from(vaultSalt, 'hex'),
    Buffer.from(accountId, 'utf8'),
    Buffer.from(vaultKey, 'base64'),
    Buffer.from(secret1, 'hex'),
  );
  // ~~~~~~~~~~~~~~~~~~~~~ //
  // Compute and Submit A  //
  // ~~~~~~~~~~~~~~~~~~~~~ //
  const srpA = srpClient.computeA().toString('hex');
  const {
    sessionStarterId,
    srpB,
    error: verifyAError,
  } = await insomniaFetch<{
    sessionStarterId: string;
    srpB: string;
    error?: string;
    message?: string;
  }>({
    method: 'POST',
    path: '/v1/user/vault-verify-a',
    data: { srpA },
    sessionId,
  });
  // ~~~~~~~~~~~~~~~~~~~~~ //
  // Compute and Submit M1 //
  // ~~~~~~~~~~~~~~~~~~~~~ //
  srpClient.setB(Buffer.from(srpB, 'hex'));
  const srpM1 = srpClient.computeM1().toString('hex');
  const { srpM2, error: verifyM1Error } = await insomniaFetch<{
    srpM2: string;
    error?: string;
    message?: string;
  }>({
    method: 'POST',
    path: '/v1/user/vault-verify-m1',
    data: { srpM1, sessionStarterId },
    sessionId,
  });
  if (verifyAError || verifyM1Error) {
    return false;
  }
  // ~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Verify Server Identity M2 //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~ //
  srpClient.checkM2(Buffer.from(srpM2, 'hex'));
  const srpK = srpClient.computeK().toString('hex');
  return srpK;
};
