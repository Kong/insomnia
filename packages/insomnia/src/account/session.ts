import * as srp from 'srp-js';

import { userSession } from '../models';
import * as crypt from './crypt';

type LoginCallback = (isLoggedIn: boolean) => void;

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
  sessionExpiry: Date | null;
  email: string;
  firstName: string;
  lastName: string;
  symmetricKey: JsonWebKey;
  publicKey: JsonWebKey;
  encPrivateKey: crypt.AESMessage;
}
export function onLoginLogout(loginCallback: LoginCallback) {
  window.main.on('loggedIn', async () => {
    loginCallback(await isLoggedIn());
  });
}

/** Creates a session from a sessionId and derived symmetric key. */
export async function absorbKey(sessionId: string, key: string) {
  // Get and store some extra info (salts and keys)
  const {
    sessionExpiry,
    publicKey,
    encPrivateKey,
    encSymmetricKey,
    email,
    accountId,
    firstName,
    lastName,
  } = await _whoami(sessionId);
  const symmetricKeyStr = crypt.decryptAES(key, JSON.parse(encSymmetricKey));

  const sessionExpiryDate = new Date(Date.now() + (sessionExpiry * 1000));

  // Store the information for later
  await setSessionData(
    sessionId,
    sessionExpiryDate,
    accountId,
    firstName,
    lastName,
    email,
    JSON.parse(symmetricKeyStr),
    JSON.parse(publicKey),
    JSON.parse(encPrivateKey),
  );

  window.main.loginStateChange();
}

export async function changePasswordWithToken(rawNewPassphrase: string, confirmationCode: string) {
  // Sanitize inputs
  const newPassphrase = _sanitizePassphrase(rawNewPassphrase);

  const newEmail = await getEmail(); // Use the same one

  if (!newEmail) {
    throw new Error('Session e-mail unexpectedly not set');
  }

  // Fetch some things
  const { saltEnc, encSymmetricKey } = await _whoami();
  const { saltKey, saltAuth } = await _getAuthSalts(newEmail);
  // Generate some secrets for the user based on password
  const newSecret = await crypt.deriveKey(newPassphrase, newEmail, saltEnc);
  const newAuthSecret = await crypt.deriveKey(newPassphrase, newEmail, saltKey);
  const newVerifier = srp
    .computeVerifier(
      _getSrpParams(),
      Buffer.from(saltAuth, 'hex'),
      Buffer.from(newEmail || '', 'utf8'),
      Buffer.from(newAuthSecret, 'hex'),
    )
    .toString('hex');
  // Re-encrypt existing keys with new secret
  const symmetricKey = JSON.stringify(_getSymmetricKey());
  const newEncSymmetricKeyJSON = crypt.encryptAES(newSecret, symmetricKey);
  const newEncSymmetricKey = JSON.stringify(newEncSymmetricKeyJSON);
  await window.main.insomniaFetch({
    method: 'POST',
    path: '/auth/change-password',
    data: {
      code: confirmationCode,
      newEmail: newEmail,
      encSymmetricKey: encSymmetricKey,
      newVerifier,
      newEncSymmetricKey,
    },
    sessionId: await getCurrentSessionId(),
  });
}

export async function sendPasswordChangeCode() {
  window.main.insomniaFetch({
    method: 'POST',
    path: '/auth/send-password-code',
    sessionId: await getCurrentSessionId(),
  });
}

export async function getPublicKey() {
  return (await getUserSession())?.publicKey;
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
  const { id, sessionExpiry } = await userSession.getOrCreate();
  try {
    if (typeof sessionExpiry !== 'string' || !sessionExpiry) {
      return '';
    }

    const isExpired = new Date(sessionExpiry).getTime() < Date.now();
    if (isExpired) {
      console.log('Session has expired', sessionExpiry);
      return '';
    }
    return id;
  } catch (e) {
    console.log('Error in expiry logic', e);
    return '';
  }
}

export async function getAccountId() {
  return (await getUserSession())?.accountId;
}

export async function getEmail() {
  return (await getUserSession())?.email;
}

export async function getFullName() {
  const { firstName, lastName } = await getUserSession() || {};
  return `${firstName} ${lastName}`.trim();
}

/** Check if we (think) we have a session */
export async function isLoggedIn() {
  return Boolean(await getCurrentSessionId());
}

/** Log out and delete session data */
export async function logout() {
  const sessionId = await getCurrentSessionId();
  if (sessionId) {
    try {
      window.main.insomniaFetch({
        method: 'POST',
        path: '/auth/logout',
        sessionId,
      });
    } catch (error) {
      // Not a huge deal if this fails, but we don't want it to prevent the
      // user from signing out.
      console.warn('Failed to logout', error);
    }
  }

  _unsetSessionData();
  window.main.loginStateChange();
}

/** Set data for the new session and store it encrypted with the sessionId */
export async function setSessionData(
  id: string,
  sessionExpiry: Date,
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
    sessionExpiry,
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

// ~~~~~~~~~~~~~~~~ //
// Helper Functions //
// ~~~~~~~~~~~~~~~~ //
async function _getSymmetricKey() {
  return (await getUserSession())?.symmetricKey;
}

async function _whoami(sessionId: string | null = null): Promise<WhoamiResponse> {
  const response = await window.main.insomniaFetch<WhoamiResponse | string>({
    method: 'GET',
    path: '/auth/whoami',
    sessionId: sessionId || await getCurrentSessionId(),
  });
  if (typeof response === 'string') {
    throw new Error('Unexpected plaintext response: ' + response);
  }
  if (response && !response?.encSymmetricKey) {
    throw new Error('Unexpected response: ' + JSON.stringify(response));
  }
  return response;
}

async function _getAuthSalts(email: string) {
  const response = await window.main.insomniaFetch<{ saltKey: string; saltAuth: string }>({
    method: 'POST',
    path: '/auth/login-s',
    data: { email },
    sessionId: await getCurrentSessionId(),
  });

  return response;
}

export async function getUserSession(): Promise<SessionData> {
  const userData = await userSession.getOrCreate();

  return userData;
};

async function _unsetSessionData() {
  await userSession.getOrCreate();
  await userSession.update(await userSession.getOrCreate(), {
    id: '',
    sessionExpiry: null,
    accountId: '',
    email: '',
    firstName: '',
    lastName: '',
    symmetricKey: {} as JsonWebKey,
    publicKey: {} as JsonWebKey,
    encPrivateKey: {} as crypt.AESMessage,
  });
}

function _getSrpParams() {
  return srp.params[2048];
}

function _sanitizePassphrase(passphrase: string) {
  return passphrase.trim().normalize('NFKD');
}

export async function migrateFromLocalStorage() {
  const sessionId = window.localStorage.getItem('currentSessionId');

  if (!sessionId) {
    return;
  }

  const sessionKey = `session__${(sessionId || '').slice(0, 10)}`;
  const session = window.localStorage.getItem(sessionKey);

  if (!session) {
    return;
  }

  try {
    const sessionData = JSON.parse(session) as SessionData;

    const currentUserSession = await userSession.getOrCreate();

    if (currentUserSession.id) {
      console.warn('Session already exists, skipping migration');
    } else {
      await userSession.update(currentUserSession, sessionData);
    }
  } catch (e) {
    console.error('Failed to parse session data', e);
  } finally {
    // Clean up local storage session data
    window.localStorage.removeItem(sessionKey);
    window.localStorage.removeItem('currentSessionId');
  }

  return;
}
