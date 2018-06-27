import srp from 'srp-js';
import * as crypt from './crypt';
import * as util from '../common/fetch';

/** Create a new session for the user */
export async function login(rawEmail, rawPassphrase) {
  // ~~~~~~~~~~~~~~~ //
  // Sanitize Inputs //
  // ~~~~~~~~~~~~~~~ //

  const email = _sanitizeEmail(rawEmail);
  const passphrase = _sanitizePassphrase(rawPassphrase);

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Fetch Salt and Submit A To Server //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  const { saltKey, saltAuth } = await util.post('/auth/login-s', { email });
  const authSecret = await crypt.deriveKey(passphrase, email, saltKey);
  const secret1 = await crypt.srpGenKey();
  const c = new srp.Client(
    _getSrpParams(),
    Buffer.from(saltAuth, 'hex'),
    Buffer.from(email, 'utf8'),
    Buffer.from(authSecret, 'hex'),
    Buffer.from(secret1, 'hex')
  );
  const srpA = c.computeA().toString('hex');
  const { sessionStarterId, srpB } = await util.post('/auth/login-a', {
    srpA,
    email
  });

  // ~~~~~~~~~~~~~~~~~~~~~ //
  // Compute and Submit M1 //
  // ~~~~~~~~~~~~~~~~~~~~~ //

  c.setB(Buffer.from(srpB, 'hex'));
  const srpM1 = c.computeM1().toString('hex');
  const { srpM2 } = await util.post('/auth/login-m1', {
    srpM1,
    sessionStarterId
  });

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
    lastName
  } = await whoami(sessionId);

  const derivedSymmetricKey = await crypt.deriveKey(passphrase, email, saltEnc);
  const symmetricKeyStr = await crypt.decryptAES(
    derivedSymmetricKey,
    JSON.parse(encSymmetricKey)
  );

  // Store the information for later
  setSessionData(
    sessionId,
    accountId,
    firstName,
    lastName,
    email,
    JSON.parse(symmetricKeyStr),
    JSON.parse(publicKey),
    JSON.parse(encPrivateKey)
  );
}

export function syncCreateResourceGroup(
  parentResourceId,
  name,
  encSymmetricKey
) {
  return util.post('/api/resource_groups', {
    parentResourceId,
    name,
    encSymmetricKey
  });
}

export function syncGetResourceGroup(id) {
  return util.get(`/api/resource_groups/${id}`);
}

export function syncPull(body) {
  return util.post('/sync/pull', body);
}

export function syncPush(body) {
  return util.post('/sync/push', body);
}

export function syncResetData() {
  return util.post('/auth/reset');
}

export function syncFixDupes(resourceGroupIds) {
  return util.post('/sync/fix-dupes', { ids: resourceGroupIds });
}

export function unshareWithAllTeams(resourceGroupId) {
  return util.put(`/api/resource_groups/${resourceGroupId}/unshare`);
}

export async function shareWithTeam(resourceGroupId, teamId, rawPassphrase) {
  // Ask the server what we need to do to invite the member
  const instructions = await util.post(
    `/api/resource_groups/${resourceGroupId}/share-a`,
    { teamId }
  );

  // Compute keys necessary to invite the member
  const passPhrase = _sanitizePassphrase(rawPassphrase);
  const { email, saltEnc, encPrivateKey, encSymmetricKey } = await whoami();
  const secret = await crypt.deriveKey(passPhrase, email, saltEnc);
  let symmetricKey;
  try {
    symmetricKey = crypt.decryptAES(secret, JSON.parse(encSymmetricKey));
  } catch (err) {
    throw new Error('Invalid password');
  }
  const privateKey = crypt.decryptAES(
    JSON.parse(symmetricKey),
    JSON.parse(encPrivateKey)
  );
  const privateKeyJWK = JSON.parse(privateKey);
  const resourceGroupSymmetricKey = crypt.decryptRSAWithJWK(
    privateKeyJWK,
    instructions.encSymmetricKey
  );

  // Build the invite data request
  const newKeys = {};
  for (const accountId of Object.keys(instructions.keys)) {
    const accountPublicKeyJWK = JSON.parse(instructions.keys[accountId]);
    newKeys[accountId] = crypt.encryptRSAWithJWK(
      accountPublicKeyJWK,
      resourceGroupSymmetricKey
    );
  }

  // Actually share it with the team
  await util.post(`/api/resource_groups/${resourceGroupId}/share-b`, {
    teamId,
    keys: newKeys
  });
}

export function getPublicKey() {
  return getSessionData().publicKey;
}

export function getPrivateKey() {
  const { symmetricKey, encPrivateKey } = getSessionData();
  const privateKeyStr = crypt.decryptAES(symmetricKey, encPrivateKey);
  return JSON.parse(privateKeyStr);
}

export function getCurrentSessionId() {
  if (window) {
    return window.localStorage.getItem('currentSessionId');
  } else {
    return false;
  }
}

export function getAccountId() {
  return getSessionData().accountId;
}

export function getEmail() {
  return getSessionData().email;
}

export function getFirstName() {
  return getSessionData().firstName;
}

export function getFullName() {
  const { firstName, lastName } = getSessionData();
  return `${firstName || ''} ${lastName || ''}`.trim();
}

/**
 * get Data about the current session
 * @returns Object
 */
export function getSessionData() {
  const sessionId = getCurrentSessionId();
  if (!sessionId || !window) {
    return {};
  }

  const dataStr = window.localStorage.getItem(getSessionKey(sessionId));
  return JSON.parse(dataStr);
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
  encPrivateKey
) {
  const dataStr = JSON.stringify({
    id: sessionId,
    accountId: accountId,
    symmetricKey: symmetricKey,
    publicKey: publicKey,
    encPrivateKey: encPrivateKey,
    email: email,
    firstName: firstName,
    lastName: lastName
  });

  window.localStorage.setItem(getSessionKey(sessionId), dataStr);

  // NOTE: We're setting this last because the stuff above might fail
  window.localStorage.setItem('currentSessionId', sessionId);
}

/** Unset the session data (log out) */
export function unsetSessionData() {
  const sessionId = getCurrentSessionId();
  window.localStorage.removeItem(getSessionKey(sessionId));
  window.localStorage.removeItem(`currentSessionId`);
}

/** Check if we (think) we have a session */
export function isLoggedIn() {
  return getCurrentSessionId();
}

/** Log out and delete session data */
export async function logout() {
  try {
    await util.post('/auth/logout');
  } catch (e) {
    // Not a huge deal if this fails, but we don't want it to prevent the
    // user from signing out.
    console.warn('Failed to logout', e);
  }

  unsetSessionData();
}

export async function listTeams() {
  return util.get('/api/teams');
}

export async function endTrial() {
  await util.put('/api/billing/end-trial');
}

export function whoami(sessionId = null) {
  return util.get('/auth/whoami', sessionId);
}

export function getSessionKey(sessionId) {
  return `session__${(sessionId || '').slice(0, 10)}`;
}

// ~~~~~~~~~~~~~~~~ //
// Helper Functions //
// ~~~~~~~~~~~~~~~~ //

function _getSrpParams() {
  return srp.params[2048];
}

function _sanitizeEmail(email) {
  return email.trim().toLowerCase();
}

function _sanitizePassphrase(passphrase) {
  return passphrase.trim().normalize('NFKD');
}
