import { userSession } from '../../models';
import { insomniaFetch } from '../insomniaFetch';
import * as crypt from './crypt';

export interface WhoamiResponse {
  sessionAge: number;
  sessionExpiry: number;
  accountId: string;
  email: string;
  firstName: string;
  lastName: string;
  created: number;
  publicKey: string;
  encSymmetricKey: string;
  encPrivateKey: string;
  saltEnc: string;
  isPaymentRequired: boolean;
  isTrialing: boolean;
  isVerified: boolean;
  isAdmin: boolean;
  trialEnd: string;
  planName: string;
  planId: string;
  canManageTeams: boolean;
  maxTeamMembers: number;
}

export interface SessionData {
  accountId: string;
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  symmetricKey: JsonWebKey;
  publicKey: JsonWebKey;
  encPrivateKey: crypt.AESMessage;
}

/** Creates a session from a sessionId and derived symmetric key. */
export async function absorbKey(sessionId: string, key: string) {
  // Get and store some extra info (salts and keys)
  const { publicKey, encPrivateKey, encSymmetricKey, email, accountId, firstName, lastName } = await _whoami(sessionId);
  const symmetricKeyStr = crypt.decryptAES(key, JSON.parse(encSymmetricKey));

  // Store the information for later
  await setSessionData(
    sessionId,
    accountId,
    firstName,
    lastName,
    email,
    JSON.parse(symmetricKeyStr),
    JSON.parse(publicKey),
    JSON.parse(encPrivateKey),
  );
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

  const privateKeyStr = crypt.decryptAES(symmetricKey, encPrivateKey);
  return JSON.parse(privateKeyStr) as JsonWebKey;
}

export async function getCurrentSessionId() {
  const { id } = await userSession.getOrCreate();
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
  encPrivateKey: crypt.AESMessage,
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

  const userData = await userSession.getOrCreate();
  await userSession.update(userData, sessionData);

  return sessionData;
}

/** Update the session data with vault salt and vault key */
export async function setVaultSessionData(vaultSalt: string, vaultKey: string) {
  const userData = await userSession.getOrCreate();
  await userSession.update(userData, { vaultSalt, vaultKey });
}

// ~~~~~~~~~~~~~~~~ //
// Helper Functions //
// ~~~~~~~~~~~~~~~~ //

async function _whoami(sessionId: string | null = null): Promise<WhoamiResponse> {
  const response = await insomniaFetch<WhoamiResponse | string>({
    method: 'GET',
    path: '/auth/whoami',
    sessionId: sessionId || (await getCurrentSessionId()),
  });
  if (typeof response === 'string') {
    throw new Error('Unexpected plaintext response: ' + response);
  }
  if (response && !response?.encSymmetricKey) {
    throw new Error('Unexpected response: ' + JSON.stringify(response));
  }
  return response;
}

export async function getUserSession(): Promise<SessionData> {
  const userData = await userSession.getOrCreate();

  return userData;
}

export async function unsetSessionData() {
  await userSession.getOrCreate();
  await userSession.update(await userSession.getOrCreate(), {
    id: '',
    accountId: '',
    email: '',
    firstName: '',
    lastName: '',
    symmetricKey: {} as JsonWebKey,
    publicKey: {} as JsonWebKey,
    encPrivateKey: {} as crypt.AESMessage,
    vaultSalt: '',
    vaultKey: '',
  });
}
