import type { AESMessage } from 'insomnia-data';
import { services } from 'insomnia-data';

import { getRuntime } from '~/runtimes';

export interface SessionData {
  accountId: string;
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  symmetricKey: JsonWebKey;
  publicKey: JsonWebKey;
  encPrivateKey: AESMessage;
}

export async function getPrivateKey() {
  const sessionData = await getUserSession();

  if (!sessionData) {
    throw new Error("Can't get private key: session is blank.");
  }

  const { symmetricKey, encPrivateKey } = sessionData;

  if (!symmetricKey || !encPrivateKey) {
    throw new Error("Can't get private key: session is missing keys.");
  }

  const privateKeyStr = await getRuntime().crypto.decryptAES(symmetricKey, encPrivateKey);
  return JSON.parse(privateKeyStr) as JsonWebKey;
}

export async function getCurrentSessionId() {
  const { id } = await services.userSession.get();
  return id;
}

export async function getAccountId() {
  return (await getUserSession())?.accountId;
}

/** Check if we (think) we have a session */
export async function isLoggedIn() {
  return Boolean(await getCurrentSessionId());
}

/** Set data for the new session and store it encrypted with the sessionId */
export async function setSessionData(
  id: string,
  accountId: string,
  firstName: string,
  lastName: string,
  email: string,
  symmetricKey: JsonWebKey,
  publicKey: JsonWebKey,
  encPrivateKey: AESMessage,
) {
  const sessionData: SessionData = {
    id,
    accountId,
    symmetricKey,
    publicKey,
    encPrivateKey,
    email,
    firstName,
    lastName,
  };

  await services.userSession.update(sessionData);

  return sessionData;
}

/** Update the session data with vault salt and vault key */
export async function setVaultSessionData(vaultSalt: string, vaultKey: string) {
  await services.userSession.update({ vaultSalt, vaultKey });
}

export async function getUserSession(): Promise<SessionData> {
  const userData = await services.userSession.get();

  return userData;
}

export async function unsetSessionData() {
  await services.userSession.remove();
}
