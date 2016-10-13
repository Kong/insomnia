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
  const keypair = await crypt.generateKeyPairJWK();

  // Encode keypairs (and encrypt private key)
  const privateKeyStr = JSON.stringify(keypair.privateKey);
  const publicKeyStr = JSON.stringify(keypair.publicKey);
  const encPrivateKey = crypt.encryptAES(encSecret, privateKeyStr, 'n/a');
  const encPrivateKeyStr = JSON.stringify(encPrivateKey);

  // Add keys to account
  account.publicKey = publicKeyStr;
  account.encPrivateKey = encPrivateKeyStr;

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
  const email = _sanitizeEmail(rawEmail);
  const passphrase = _sanitizePassphrase(rawPassphrase);

  // Fetch the salt
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

  const {sessionStarterId, srpB} = await util.fetchPost('/auth/login-a', {
    srpA,
    email
  });

  c.setB(new Buffer(srpB, 'hex'));
  const srpM1 = c.computeM1().toString('hex');
  const srpK = c.computeK().toString('hex');

  const {srpM2} = await util.fetchPost('/auth/login-m1', {
    srpM1,
    sessionStarterId
  });

  c.checkM2(new Buffer(srpM2, 'hex'));
  localStorage.setItem('sid', srpK);
  return srpK;
}

/**
 * Log out
 */
export function logout () {
  return util.fetchPost('/auth/logout');
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
