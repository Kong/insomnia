import srp from 'srp';
import * as crypt from './crypt';
import * as util from './util';

/**
 * Create a new account
 *
 * @returns {Promise}
 * @param rawEmail
 * @param rawPassphrase
 */
export async function signup (rawEmail, rawPassphrase) {
  const email = _sanitizeEmail(rawEmail);
  const passphrase = _sanitizePassphrase(rawPassphrase);

  const account = await _initAccount(email);
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
 * Convenience function to both signup and log in at the same time
 *
 * @param rawEmail
 * @param rawPassphrase
 */
export async function signupAndLogin (rawEmail, rawPassphrase) {
  await signup(rawEmail, rawPassphrase);
  await login(rawEmail, rawPassphrase);
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

  // Store session ID (K)
  const srpK = c.computeK().toString('hex');
  localStorage.setItem('sid', srpK);

  // Get and store some extra info (salts and keys)
  const {publicKey, encPrivateKey, saltEnc} = await whoami();
  const sym = await crypt.deriveKey(passphrase, email, saltEnc);

  localStorage.setItem('sym', sym);
  localStorage.setItem('pub', publicKey);
  localStorage.setItem('encPrv', encPrivateKey);
  localStorage.setItem('email', email);
}

/**
 * Get public key (if we have it)
 *
 * @returns String
 */
export function getPublicKey () {
  const jwkJSON = localStorage.getItem('pub');
  return jwkJSON ? JSON.parse(jwkJSON) : null;
}

export function getEncryptedPrivateKey () {
  const json = localStorage.getItem('encPrv');
  return json ? JSON.parse(json) : null;
}

export function getSymmetricKey () {
  return localStorage.getItem('sym');
}

/**
 * Check if we (think) we have a session
 *
 * @returns {boolean}
 */
export function isLoggedIn () {
  return !!localStorage.getItem('sid');
}

/**
 * Log out
 */
export async function logout () {
  await util.fetchPost('/auth/logout');
  localStorage.removeItem('sid');
}

/**
 * Who Am I
 */
export function whoami () {
  return util.fetchGet('/auth/whoami');
}


// ~~~~~~~~~~~~~~~~ //
// Helper Functions //
// ~~~~~~~~~~~~~~~~ //

async function _initAccount (email) {
  return {
    email: email,
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
