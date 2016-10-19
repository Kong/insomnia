import srp from 'srp';
import * as crypt from './crypt';
import * as util from './util';

const NO_SESSION = '__NO_SESSION__';

/**
 * Create a new account
 *
 * @returns {Promise}
 * @param firstName
 * @param lastName
 * @param rawEmail
 * @param rawPassphrase
 */
export async function signup (firstName, lastName, rawEmail, rawPassphrase) {
  const email = _sanitizeEmail(rawEmail);
  const passphrase = _sanitizePassphrase(rawPassphrase);

  const account = await _initAccount(firstName, lastName, email);
  const authSecret = await crypt.deriveKey(passphrase, account.email, account.saltKey);
  const encSecret = await crypt.deriveKey(passphrase, account.email, account.saltEnc);

  // Compute the verifier key
  // Add verifier to account object
  account.verifier = srp.computeVerifier(
    _getSrpParams(),
    Buffer.from(account.saltAuth, 'hex'),
    Buffer.from(account.email, 'utf8'),
    Buffer.from(authSecret, 'hex')
  ).toString('hex');

  // Generate keypair
  const {publicKey, privateKey} = await crypt.generateKeyPairJWK();

  // Encode keypairs (and encrypt private key)
  const privateJWKStr = JSON.stringify(privateKey);
  const publicJWKStr = JSON.stringify(publicKey);
  const encPrivateJWKMessage = crypt.encryptAES(encSecret, privateJWKStr, 'n/a');
  const encPrivateJWKMessageStr = JSON.stringify(encPrivateJWKMessage);

  // Add keys to account
  account.publicKey = publicJWKStr;
  account.encPrivateKey = encPrivateJWKMessageStr;

  return util.fetchPost('/auth/signup', account);
}


/**
 * Create a new session
 *
 * @returns {Promise}
 * @param rawEmail
 * @param rawPassphrase
 */
export async function login (rawEmail, rawPassphrase) {

  // ~~~~~~~~~~~~~~~ //
  // Sanitize Inputs //
  // ~~~~~~~~~~~~~~~ //

  const email = _sanitizeEmail(rawEmail);
  const passphrase = _sanitizePassphrase(rawPassphrase);

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Fetch Salt and Submit A To Server //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  const {saltKey, saltAuth} = await util.fetchPost('/auth/login-s', {email});
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
  const {sessionStarterId, srpB} = await util.fetchPost(
    '/auth/login-a',
    {srpA, email}
  );

  // ~~~~~~~~~~~~~~~~~~~~~ //
  // Compute and Submit M1 //
  // ~~~~~~~~~~~~~~~~~~~~~ //

  c.setB(new Buffer(srpB, 'hex'));
  const srpM1 = c.computeM1().toString('hex');
  const {srpM2} = await util.fetchPost('/auth/login-m1', {
    srpM1,
    sessionStarterId,
  });

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
    saltEnc,
    accountId,
    firstName
  } = await whoami(sessionId);
  const symmetricKey = await crypt.deriveKey(passphrase, email, saltEnc);

  // Store the information for later
  setSessionData(
    sessionId,
    accountId,
    firstName,
    email,
    symmetricKey,
    JSON.parse(publicKey),
    JSON.parse(encPrivateKey),
  );
}

export function getPublicKey () {
  return getSessionData().publicKey;
}

export function getAccountPrivateKey () {
  const {symmetricKey, encPrivateKey} = getSessionData();
  const privateKeyStr = crypt.decryptAES(symmetricKey, encPrivateKey);
  return JSON.parse(privateKeyStr);
}

export function getCurrentSessionId () {
  return localStorage.getItem('currentSessionId') || NO_SESSION;
}

export function getEmail () {
  return getSessionData().email;
}

export function getFirstName () {
  return getSessionData().firstName;
}

/**
 * get Data about the current session
 * @returns Object
 */
export function getSessionData () {
  const sessionId = getCurrentSessionId();
  if (!sessionId) {
    return null;
  }

  const messageStr = localStorage.getItem(`session__${sessionId}`);
  const dataStr = crypt.decryptAES(sessionId, JSON.parse(messageStr));
  return messageStr ? JSON.parse(dataStr) : null;
}

/**
 * Set data for the new session and store it encrypted with the sessionId
 *
 * @param sessionId
 * @param accountId
 * @param firstName
 * @param symmetricKey
 * @param publicKey
 * @param encPrivateKey
 * @param email
 */
export function setSessionData (
  sessionId,
  accountId,
  firstName,
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
  });

  const message = crypt.encryptAES(sessionId, dataStr);
  localStorage.setItem(`session__${sessionId}`, JSON.stringify(message));

  // NOTE: We're setting this last because the stuff above might fail
  localStorage.setItem('currentSessionId', sessionId);
}

/**
 * Unset the session data (log out)
 */
export function unsetSessionData () {
  const sessionId = getCurrentSessionId();
  localStorage.removeItem(`session__${sessionId}`);
  localStorage.removeItem(`currentSessionId`);
}

/**
 * Check if we (think) we have a session
 *
 * @returns {boolean}
 */
export function isLoggedIn () {
  return getCurrentSessionId() !== NO_SESSION;
}

/**
 * Log out
 */
export async function logout () {
  await util.fetchPost('/auth/logout');
  unsetSessionData();
}

/**
 * Who Am I
 */
export function whoami (sessionId = null) {
  return util.fetchGet('/auth/whoami', sessionId);
}


// ~~~~~~~~~~~~~~~~ //
// Helper Functions //
// ~~~~~~~~~~~~~~~~ //

async function _initAccount (firstName, lastName, email) {
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
