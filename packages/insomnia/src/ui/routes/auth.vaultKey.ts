
import * as srp from '@getinsomnia/srp-js';
import { type ActionFunction } from 'react-router-dom';

import { settings as settingModel, userSession as sessionModel } from '../../models';

const {
  Buffer,
  Client,
  computeVerifier,
  decryptAES,
  decryptRSAWithJWK,
  deriveKey,
  encryptAES,
  encryptRSAWithJWK,
  generateAccountId,
  generateAES256Key,
  generateKeyPairJWK,
  getRandomHex,
  params,
  srpGenKey,
  decodeBase64,
  encodeBase64,
  seal,
} = srp;

export const vaultKeyParams = params[2048];

export const _sanitizeEmail = (email: string) => {
  return email.trim().toLowerCase();
};
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

export const createVaultKey: ActionFunction = async ({ request }) => {
  const userSession = await sessionModel.getOrCreate();
  const userSetting = await settingModel.getOrCreate();
  const { saveVaultKeyToOSSecretManager } = userSetting;
  const { accountId } = userSession;

  const saltAuth = await getRandomHex();
  const newVaultKey = await generateAES256Key();
  const base64encodeVaultKey = base64encode(newVaultKey);

  // Compute the verifier
  const verifier = srp
    .computeVerifier(
      vaultKeyParams,
      Buffer.from(saltAuth, 'hex'),
      Buffer.from(accountId, 'utf8'),
      Buffer.from(base64encodeVaultKey, 'base64'),
    )
    .toString('hex');
  // send saltAuth & verifier to server

  if (saveVaultKeyToOSSecretManager) {
    // save vault key to os secret mangaer
    window.main.keyChain.saveToKeyChain(accountId, base64encodeVaultKey);
  }
};

export const validateVaultKey: ActionFunction = async ({ request }) => {
  const data = await request.json();
  const userSession = await sessionModel.getOrCreate();
  const { accountId } = userSession;
  // TODO fetch salt from server
  const sault = '';

  const secret1 = await srpGenKey();
  const srpClient = new Client(
    vaultKeyParams,
    Buffer.from(sault, 'hex'),
    Buffer.from(accountId, 'utf8'),
    Buffer.from(data.vaultKey, 'base64'),
    Buffer.from(secret1, 'hex'),
  );
  const srpA = srpClient.computeA().toString('hex');
  // TODO send srpA to server and get srpB
  const serverComputeB = '';
  srpClient.setB(new Buffer(serverComputeB, 'hex'));
  const srpM1 = srpClient.computeM1().toString('hex');
  // TODO send srpM1 to server and get srpM2



  return srpClient.computeK().toString('hex');
};
