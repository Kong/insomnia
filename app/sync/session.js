import srp from 'srp';
import * as crypt from './crypt';
import * as util from '../common/fetch';
import {trackEvent, setAccountId} from '../analytics';

const NO_SESSION = '__NO_SESSION__';

/** Create a new Account for the user */
export async function signup (firstName, lastName, rawEmail, rawPassphrase) {

  const email = _sanitizeEmail(rawEmail);
  const passphrase = _sanitizePassphrase(rawPassphrase);

  // Get a fancy new Account object
  const account = await _initAccount(firstName, lastName, email);

  // Generate some secrets for the user base'd on password
  const authSecret = await crypt.deriveKey(passphrase, account.email, account.saltKey);
  const derivedSymmetricKey = await crypt.deriveKey(passphrase, account.email, account.saltEnc);

  // Generate public/private keypair and symmetric key for Account
  const {publicKey, privateKey} = await crypt.generateKeyPairJWK();
  const symmetricKeyJWK = await crypt.generateAES256Key();

  // Compute the verifier key and add it to the Account object
  account.verifier = srp.computeVerifier(
    _getSrpParams(),
    Buffer.from(account.saltAuth, 'hex'),
    Buffer.from(account.email, 'utf8'),
    Buffer.from(authSecret, 'hex')
  ).toString('hex');

  // Encode keypair
  const encSymmetricJWKMessage = crypt.encryptAES(derivedSymmetricKey, JSON.stringify(symmetricKeyJWK));
  const encPrivateJWKMessage = crypt.encryptAES(symmetricKeyJWK, JSON.stringify(privateKey));

  // Add keys to account
  account.publicKey = JSON.stringify(publicKey);
  account.encPrivateKey = JSON.stringify(encPrivateJWKMessage);
  account.encSymmetricKey = JSON.stringify(encSymmetricJWKMessage);

  const response = await util.post('/auth/signup', account);

  trackEvent('Session', 'Signup');

  return response;
}


/** Create a new session for the user */
export async function login (rawEmail, rawPassphrase) {

  // ~~~~~~~~~~~~~~~ //
  // Sanitize Inputs //
  // ~~~~~~~~~~~~~~~ //

  const email = _sanitizeEmail(rawEmail);
  const passphrase = _sanitizePassphrase(rawPassphrase);

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Fetch Salt and Submit A To Server //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  const {saltKey, saltAuth} = await util.post('/auth/login-s', {email});
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
  const {sessionStarterId, srpB} = await util.post('/auth/login-a', {srpA, email});

  // ~~~~~~~~~~~~~~~~~~~~~ //
  // Compute and Submit M1 //
  // ~~~~~~~~~~~~~~~~~~~~~ //

  c.setB(new Buffer(srpB, 'hex'));
  const srpM1 = c.computeM1().toString('hex');
  const {srpM2} = await util.post('/auth/login-m1', {srpM1, sessionStarterId,});

  // ~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Verify Server Identity M2 //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~ //

  c.checkM2(new Buffer(srpM2, 'hex'));

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

  // Set the ID for Google Analytics
  setAccountId(accountId);
  trackEvent('Session', 'Login');
}

export async function subscribe (tokenId, planId) {
  const response = await util.post('/api/billing/subscriptions', {
    token: tokenId,
    quantity: 1,
    plan: planId,
  });
  trackEvent('Session', 'Subscribe', planId, 1);
  return response;
}

export function syncCreateResourceGroup (parentResourceId, name, encSymmetricKey) {
  return util.post('/api/resource_groups', {parentResourceId, name, encSymmetricKey});
}

export function syncGetResourceGroup (id) {
  return util.get(`/api/resource_groups/${id}`);
}

export function syncPull (body) {
  return util.post('/sync/pull', body);
}

export function syncPush (body) {
  return util.post('/sync/push', body);
}

export function syncResetData () {
  return util.post('/auth/reset');
}

export function getPublicKey () {
  return getSessionData().publicKey;
}

export function getPrivateKey () {
  const {symmetricKey, encPrivateKey} = getSessionData();
  const privateKeyStr = crypt.decryptAES(symmetricKey, encPrivateKey);
  return JSON.parse(privateKeyStr);
}

export function getCurrentSessionId () {
  return localStorage.getItem('currentSessionId') || NO_SESSION;
}

export function getAccountId () {
  return getSessionData().accountId;
}

export function getEmail () {
  return getSessionData().email;
}

export function getFirstName () {
  return getSessionData().firstName;
}

export function getFullName () {
  const {firstName, lastName} = getSessionData();
  return `${firstName || ''} ${lastName || ''}`.trim();
}

/**
 * get Data about the current session
 * @returns Object
 */
export function getSessionData () {
  const sessionId = getCurrentSessionId();
  if (sessionId == NO_SESSION) {
    return {};
  }

  const dataStr = localStorage.getItem(getSessionKey(sessionId));
  return JSON.parse(dataStr);
}

/** Set data for the new session and store it encrypted with the sessionId */
export function setSessionData (sessionId,
                                accountId,
                                firstName,
                                lastName,
                                email,
                                symmetricKey,
                                publicKey,
                                encPrivateKey) {
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

  localStorage.setItem(getSessionKey(sessionId), dataStr);

  // NOTE: We're setting this last because the stuff above might fail
  localStorage.setItem('currentSessionId', sessionId);
}

/** Unset the session data (log out) */
export function unsetSessionData () {
  const sessionId = getCurrentSessionId();
  localStorage.removeItem(getSessionKey(sessionId));
  localStorage.removeItem(`currentSessionId`);
}

/** Check if we (think) we have a session */
export function isLoggedIn () {
  return getCurrentSessionId() !== NO_SESSION;
}

/** Log out and delete session data */
export async function logout () {
  try {
    await util.post('/auth/logout');
  } catch (e) {
    // Not a huge deal if this fails, but we don't want it to prevent the
    // user from signing out.
    console.warn('Failed to logout', e);
  }

  unsetSessionData();
  trackEvent('Session', 'Logout');
}

export async function listTeams () {
  return util.get('/api/teams');
}

export async function cancelAccount () {
  await util.del('/api/billing/subscriptions');
  trackEvent('Session', 'Cancel Account');
}


export function getSessionKey (sessionId) {
  return `session__${sessionId.slice(0, 10)}`
}

// ~~~~~~~~~~~~~~~~ //
// Helper Functions //
// ~~~~~~~~~~~~~~~~ //

function _whoami (sessionId = null) {
  return util.get('/auth/whoami', sessionId);
}

export async function _initAccount (firstName, lastName, email) {
  return {
    email,
    firstName,
    lastName,
    id: await crypt.generateAccountId(),
    saltEnc: await crypt.getRandomHex(),
    saltAuth: await crypt.getRandomHex(),
    saltKey: await crypt.getRandomHex(),
  };
}

function _getSrpParams () {
  return srp.params[2048];
}

function _sanitizeEmail (email) {
  return email.trim().toLowerCase();
}

function _sanitizePassphrase (passphrase) {
  return passphrase.trim().normalize('NFKD');
}
