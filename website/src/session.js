import srp from 'srp-js';
import * as crypt from './crypt';
import * as util from './fetch';

/** Create a new Account for the user */
export async function signup (firstName, lastName, rawEmail, rawPassphrase, emailsOk = true, loginAfter = false) {
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
  account.emailNewsletter = emailsOk;

  const signupData = await util.post('/auth/signup', account);

  if (loginAfter) {
    await login(rawEmail, rawPassphrase, authSecret);
  }

  return signupData;
}

export function signupAndLogin (firstName, lastName, rawEmail, rawPassphrase, emailsOk) {
  return signup(firstName, lastName, rawEmail, rawPassphrase, emailsOk, true);
}

/** Create a new session for the user */
export async function login (rawEmail, rawPassphrase, authSecret = null) {

  // ~~~~~~~~~~~~~~~ //
  // Sanitize Inputs //
  // ~~~~~~~~~~~~~~~ //

  const email = _sanitizeEmail(rawEmail);
  const passphrase = _sanitizePassphrase(rawPassphrase);

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Fetch Salt and Submit A To Server //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  const {saltKey, saltAuth} = await getAuthSalts(email);
  authSecret = authSecret || await crypt.deriveKey(passphrase, email, saltKey);
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

  // Store the information for later
  localStorage.setItem('currentSessionId', sessionId);
}

export function subscribe (tokenId, planId, quantity) {
  return util.post('/api/billing/subscriptions', {
    token: tokenId,
    quantity: quantity,
    plan: planId,
  });
}

export function getCurrentSessionId () {
  return localStorage.getItem('currentSessionId') || '';
}

export async function logout () {
  try {
    await util.post('/auth/logout');
  } catch (e) {
    // Not a huge deal if this fails, but we don't want it to prevent the
    // user from signing out.
    console.warn('Failed to logout', e);
  }

  localStorage.removeItem('currentSessionId');
}

export async function cancelAccount () {
  await util.del('/api/billing/subscriptions');
}

export async function whoami () {
  return util.get('/auth/whoami');
}

export async function verify () {
  return util.post('/auth/verify');
}

export async function billingDetails () {
  try {
    return await util.get('/api/billing/details');
  } catch (e) {
    return null;
  }
}

export function getAuthSalts (email) {
  return util.post('/auth/login-s', {email})
}

export async function changePasswordAndEmail (rawOldPassphrase, rawNewPassphrase, rawNewEmail) {
  // Sanitize inputs
  const oldPassphrase = _sanitizePassphrase(rawOldPassphrase);
  const newPassphrase = _sanitizePassphrase(rawNewPassphrase);
  const newEmail = _sanitizeEmail(rawNewEmail);

  // Fetch some things
  const {email: oldEmail, saltEnc, encSymmetricKey} = await whoami();
  const {saltKey, saltAuth} = await getAuthSalts(oldEmail);

  // Generate some secrets for the user base'd on password
  const oldSecret = await crypt.deriveKey(oldPassphrase, oldEmail, saltEnc);
  const newSecret = await crypt.deriveKey(newPassphrase, newEmail, saltEnc);
  const oldAuthSecret = await crypt.deriveKey(oldPassphrase, oldEmail, saltKey);
  const newAuthSecret = await crypt.deriveKey(newPassphrase, newEmail, saltKey);

  // Compute the verifier key and add it to the Account object
  const oldVerifier = srp.computeVerifier(
    _getSrpParams(),
    Buffer.from(saltAuth, 'hex'),
    Buffer.from(oldEmail, 'utf8'),
    Buffer.from(oldAuthSecret, 'hex')
  ).toString('hex');

  const newVerifier = srp.computeVerifier(
    _getSrpParams(),
    Buffer.from(saltAuth, 'hex'),
    Buffer.from(newEmail, 'utf8'),
    Buffer.from(newAuthSecret, 'hex')
  ).toString('hex');

  // Re-encrypt existing keys with new secret
  const newEncSymmetricKeyJSON = crypt.recryptAES(oldSecret, newSecret, JSON.parse(encSymmetricKey));
  const newEncSymmetricKey = JSON.stringify(newEncSymmetricKeyJSON);

  return util.post(`/auth/change-password`, {
    verifier: oldVerifier,
    newEmail: newEmail,
    encSymmetricKey: encSymmetricKey,
    newVerifier,
    newEncSymmetricKey,
  });
}

export async function inviteToTeam (teamId, emailToInvite, rawPassphrase) {
  // Ask the server what we need to do to invite the member
  const inviteInstructions = await util.post(`/api/teams/${teamId}/invite-a`, {email: emailToInvite});
  const {accountPublicKey, resourceGroupKeys, accountId} = inviteInstructions;

  // Compute keys necessary to invite the member
  const passPhrase = _sanitizePassphrase(rawPassphrase);
  const {email, saltEnc, encPrivateKey, encSymmetricKey} = await whoami();
  const secret = await crypt.deriveKey(passPhrase, email, saltEnc);
  let symmetricKey;
  try {
    symmetricKey = crypt.decryptAES(secret, JSON.parse(encSymmetricKey));
  } catch (err) {
    console.log('Failed to decrypt key', err.stack);
    throw new Error('Invalid password');
  }
  const privateKey = crypt.decryptAES(JSON.parse(symmetricKey), JSON.parse(encPrivateKey));
  const privateKeyJWK = JSON.parse(privateKey);
  const publicKeyJWK = JSON.parse(accountPublicKey);

  // Build the invite data request
  const newResourceGroupKeys = {};
  for (const resourceGroupId of Object.keys(resourceGroupKeys)) {
    newResourceGroupKeys[resourceGroupId] = crypt.recryptRSAWithJWK(
      privateKeyJWK,
      publicKeyJWK,
      resourceGroupKeys[resourceGroupId]
    );
  }

  // Actually invite the member
  await util.post(`/api/teams/${teamId}/invite-b`, {
    accountId,
    resourceGroupKeys: newResourceGroupKeys,
  });
}

export function leaveTeam (teamId) {
  return util.del(`/api/teams/${teamId}/leave`);
}

export function changeTeamName (teamId, name) {
  return util.patch(`/api/teams/${teamId}`, {name});
}

export function removeFromTeam (teamId, accountId) {
  return util.del(`/api/teams/${teamId}/accounts/${accountId}`);
}

export function listTeams () {
  return util.get('/api/teams');
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
