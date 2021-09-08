import * as srp from 'srp-js';

import * as crypt from './crypt';
import * as fetch from './fetch';

type LoginCallback = (isLoggedIn: boolean) => void;

const loginCallbacks: LoginCallback[] = [];

function _callCallbacks() {
  const loggedIn = isLoggedIn();
  console.log('[session] Sync state changed loggedIn=' + loggedIn);

  for (const cb of loginCallbacks) {
    if (typeof cb === 'function') {
      cb(loggedIn);
    }
  }
}

export function onLoginLogout(loginCallback: LoginCallback) {
  loginCallbacks.push(loginCallback);
}

/** Create a new session for the user */
export async function login(rawEmail: string, rawPassphrase: string) {
  // ~~~~~~~~~~~~~~~ //
  // Sanitize Inputs //
  // ~~~~~~~~~~~~~~~ //
  const email = _sanitizeEmail(rawEmail);

  const passphrase = _sanitizePassphrase(rawPassphrase);

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Fetch Salt and Submit A To Server //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  const { saltKey, saltAuth } = await _getAuthSalts(email);
  const authSecret = await crypt.deriveKey(passphrase, email, saltKey);
  const secret1 = await crypt.srpGenKey();
  const c = new srp.Client(
    _getSrpParams(),
    Buffer.from(saltAuth, 'hex'),
    Buffer.from(email, 'utf8'),
    Buffer.from(authSecret, 'hex'),
    // @ts-expect-error -- TSCONVERSION missing type from srpGenKey
    Buffer.from(secret1, 'hex'),
  );
  const srpA = c.computeA().toString('hex');
  const { sessionStarterId, srpB } = await fetch.post(
    '/auth/login-a',
    {
      srpA,
      email,
    },
    null,
  );
  // ~~~~~~~~~~~~~~~~~~~~~ //
  // Compute and Submit M1 //
  // ~~~~~~~~~~~~~~~~~~~~~ //
  c.setB(Buffer.from(srpB, 'hex'));
  const srpM1 = c.computeM1().toString('hex');
  const { srpM2 } = await fetch.post(
    '/auth/login-m1',
    {
      srpM1,
      sessionStarterId,
    },
    null,
  );
  // ~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Verify Server Identity M2 //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~ //
  c.checkM2(Buffer.from(srpM2, 'hex'));
  // ~~~~~~~~~~~~~~~~~~~~~~ //
  // Initialize the Session //
  // ~~~~~~~~~~~~~~~~~~~~~~ //
  // Compute K (used for session ID)
  const sessionId = c.computeK().toString('hex');
  // Get and store some extra info (salts and keys)
  const {
    publicKey,
    encPrivateKey,
    encSymmetricKey,
    saltEnc,
    accountId,
    firstName,
    lastName,
  } = await _whoami(sessionId);
  const derivedSymmetricKey = await crypt.deriveKey(passphrase, email, saltEnc);
  const symmetricKeyStr = await crypt.decryptAES(derivedSymmetricKey, JSON.parse(encSymmetricKey));
  // Store the information for later
  setSessionData(
    sessionId,
    accountId,
    firstName,
    lastName,
    email,
    JSON.parse(symmetricKeyStr),
    JSON.parse(publicKey),
    JSON.parse(encPrivateKey),
  );

  _callCallbacks();
}

export async function changePasswordWithToken(rawNewPassphrase, confirmationCode) {
  // Sanitize inputs
  const newPassphrase = _sanitizePassphrase(rawNewPassphrase);

  const newEmail = getEmail(); // Use the same one

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
      Buffer.from(newEmail, 'utf8'),
      Buffer.from(newAuthSecret, 'hex'),
    )
    .toString('hex');
  // Re-encrypt existing keys with new secret
  const symmetricKey = JSON.stringify(_getSymmetricKey());
  const newEncSymmetricKeyJSON = crypt.encryptAES(newSecret, symmetricKey);
  const newEncSymmetricKey = JSON.stringify(newEncSymmetricKeyJSON);
  return fetch.post(
    '/auth/change-password',
    {
      code: confirmationCode,
      newEmail: newEmail,
      encSymmetricKey: encSymmetricKey,
      newVerifier,
      newEncSymmetricKey,
    },
    getCurrentSessionId(),
  );
}

export function sendPasswordChangeCode() {
  return fetch.post('/auth/send-password-code', null, getCurrentSessionId());
}

export function getPublicKey() {
  return _getSessionData().publicKey;
}

export function getPrivateKey() {
  const { symmetricKey, encPrivateKey } = _getSessionData();

  const privateKeyStr = crypt.decryptAES(symmetricKey, encPrivateKey);
  return JSON.parse(privateKeyStr);
}

export function getCurrentSessionId() {
  if (window) {
    return window.localStorage.getItem('currentSessionId');
  } else {
    return '';
  }
}

export function getAccountId() {
  return _getSessionData().accountId;
}

export function getEmail() {
  return _getSessionData().email;
}

export function getFirstName() {
  return _getSessionData().firstName;
}

export function getLastName() {
  return _getSessionData().lastName;
}

export function getFullName() {
  return `${getFirstName()} ${getLastName()}`.trim();
}

/** Check if we (think) we have a session */
export function isLoggedIn() {
  return !!getCurrentSessionId();
}

/** Log out and delete session data */
export async function logout() {
  try {
    await fetch.post('/auth/logout', null, getCurrentSessionId());
  } catch (e) {
    // Not a huge deal if this fails, but we don't want it to prevent the
    // user from signing out.
    console.warn('Failed to logout', e);
  }

  _unsetSessionData();

  _callCallbacks();
}

/** Set data for the new session and store it encrypted with the sessionId */
export function setSessionData(
  sessionId,
  accountId,
  firstName,
  lastName,
  email,
  symmetricKey,
  publicKey,
  encPrivateKey,
) {
  const dataStr = JSON.stringify({
    id: sessionId,
    accountId: accountId,
    symmetricKey: symmetricKey,
    publicKey: publicKey,
    encPrivateKey: encPrivateKey,
    email: email,
    firstName: firstName,
    lastName: lastName,
  });
  window.localStorage.setItem(_getSessionKey(sessionId), dataStr);
  // NOTE: We're setting this last because the stuff above might fail
  window.localStorage.setItem('currentSessionId', sessionId);
}
export async function listTeams() {
  return fetch.get('/api/teams', getCurrentSessionId());
}
export async function endTrial() {
  await fetch.put('/api/billing/end-trial', null, getCurrentSessionId());
}

// ~~~~~~~~~~~~~~~~ //
// Helper Functions //
// ~~~~~~~~~~~~~~~~ //
function _getSymmetricKey() {
  const sessionData = _getSessionData();

  return sessionData.symmetricKey;
}

function _whoami(sessionId = null) {
  return fetch.get('/auth/whoami', sessionId || getCurrentSessionId());
}

function _getAuthSalts(email) {
  return fetch.post(
    '/auth/login-s',
    {
      email,
    },
    getCurrentSessionId(),
  );
}

function _getSessionData() {
  const sessionId = getCurrentSessionId();

  if (!sessionId || !window) {
    return {};
  }

  const dataStr = window.localStorage.getItem(_getSessionKey(sessionId));
  if (dataStr === null) {
    return null;
  }
  return JSON.parse(dataStr);
}

function _unsetSessionData() {
  const sessionId = getCurrentSessionId();
  window.localStorage.removeItem(_getSessionKey(sessionId));
  window.localStorage.removeItem('currentSessionId');
}

function _getSessionKey(sessionId: string | null) {
  return `session__${(sessionId || '').slice(0, 10)}`;
}

function _getSrpParams() {
  return srp.params[2048];
}

function _sanitizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function _sanitizePassphrase(passphrase: string) {
  return passphrase.trim().normalize('NFKD');
}
