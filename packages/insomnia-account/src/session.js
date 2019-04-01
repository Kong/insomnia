const srp = require('srp-js');
const crypt = require('./crypt');
const fetch = require('./fetch');

/** Create a new session for the user */
module.exports.login = async function(rawEmail, rawPassphrase) {
  // ~~~~~~~~~~~~~~~ //
  // Sanitize Inputs //
  // ~~~~~~~~~~~~~~~ //

  const email = _sanitizeEmail(rawEmail);
  const passphrase = _sanitizePassphrase(rawPassphrase);

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Fetch Salt and Submit A To Server //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  const { saltKey, saltAuth } = await fetch.post('/auth/login-s', { email }, null);
  const authSecret = await crypt.deriveKey(passphrase, email, saltKey);
  const secret1 = await crypt.srpGenKey();
  const c = new srp.Client(
    _getSrpParams(),
    Buffer.from(saltAuth, 'hex'),
    Buffer.from(email, 'utf8'),
    Buffer.from(authSecret, 'hex'),
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
  module.exports.setSessionData(
    sessionId,
    accountId,
    firstName,
    lastName,
    email,
    JSON.parse(symmetricKeyStr),
    JSON.parse(publicKey),
    JSON.parse(encPrivateKey),
  );
};

module.exports.getPublicKey = function() {
  return _getSessionData().publicKey;
};

module.exports.getPrivateKey = function() {
  const { symmetricKey, encPrivateKey } = _getSessionData();
  const privateKeyStr = crypt.decryptAES(symmetricKey, encPrivateKey);
  return JSON.parse(privateKeyStr);
};

module.exports.getCurrentSessionId = function() {
  if (window) {
    return window.localStorage.getItem('currentSessionId');
  } else {
    return '';
  }
};

module.exports.getAccountId = function() {
  return _getSessionData().accountId;
};

module.exports.getEmail = function() {
  return _getSessionData().email;
};

module.exports.getFirstName = function() {
  return _getSessionData().firstName;
};

/** Set data for the new session and store it encrypted with the sessionId */
module.exports.setSessionData = function(
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
};

/** Check if we (think) we have a session */
module.exports.isLoggedIn = function() {
  return module.exports.getCurrentSessionId();
};

/** Log out and delete session data */
module.exports.logout = async function() {
  try {
    await fetch.post('/auth/logout', null, module.exports.getCurrentSessionId());
  } catch (e) {
    // Not a huge deal if this fails, but we don't want it to prevent the
    // user from signing out.
    console.warn('Failed to logout', e);
  }

  _unsetSessionData();
};

module.exports.listTeams = async function() {
  return fetch.get('/api/teams', module.exports.getCurrentSessionId());
};

module.exports.endTrial = async function() {
  await fetch.put('/api/billing/end-trial', module.exports.getCurrentSessionId());
};

// ~~~~~~~~~~~~~~~~ //
// Helper Functions //
// ~~~~~~~~~~~~~~~~ //

function _whoami(sessionId = null) {
  return fetch.get('/auth/whoami', sessionId || module.exports.getCurrentSessionId());
}

function _getSessionData() {
  const sessionId = module.exports.getCurrentSessionId();
  if (!sessionId || !window) {
    return {};
  }

  const dataStr = window.localStorage.getItem(_getSessionKey(sessionId));
  return JSON.parse(dataStr);
}

function _unsetSessionData() {
  const sessionId = module.exports.getCurrentSessionId();
  window.localStorage.removeItem(_getSessionKey(sessionId));
  window.localStorage.removeItem(`currentSessionId`);
}

function _getSessionKey(sessionId) {
  return `session__${(sessionId || '').slice(0, 10)}`;
}

function _getSrpParams() {
  return srp.params[2048];
}

function _sanitizeEmail(email) {
  return email.trim().toLowerCase();
}

function _sanitizePassphrase(passphrase) {
  return passphrase.trim().normalize('NFKD');
}
