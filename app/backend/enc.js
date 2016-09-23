'use strict';

/**
 * Keys to Generate
 *
 * - Symmetric private key (AES) generated from password
 *    - Only ever kept locally
 * - Asymmetric pair randomly generated and stored on server (encrypted by SPK)
 *    -
 */

const crypto = require('crypto');
const HKDF = require('hkdf');

function prepareString (str) {
  return str.trim().normalize('NFKD');
}

function prepareEmail (email) {
  return email.trim().toLocaleLowerCase();
}

function encrypt (text, key) {
  const cipher = crypto.createCipher('aes-256-ctr', key);
  let encryptedText = cipher.update(text, 'utf8', 'hex');
  return encryptedText + cipher.final('hex');
}

function decrypt (encryptedText, key) {
  const decipher = crypto.createDecipher('aes-256-ctr', key);
  var text = decipher.update(encryptedText, 'hex', 'utf8');
  return text + decipher.final('utf8');
}

function createEncryptionKey (password, email, accountKey, accountId, salt) {
  return new Promise((resolve, reject) => {

    // 0. Sanitize the things
    password = prepareString(password);
    accountKey = prepareString(accountKey);
    email = prepareEmail(email);
    const KEY_LEN = 32;

    // 1. Generate intermediate key
    new HKDF('sha512', salt, email).derive('info', 32, saltHash => {
      crypto.pbkdf2(password, saltHash, 500000, KEY_LEN, 'sha512', (err, passwordHash) => {
        if (err) {
          return reject(err);
        }

        // 2. Generate a final key using the account key and password key
        new HKDF('sha512', accountKey, accountId).derive('info', KEY_LEN, accountHash => {
          if (err) {
            return reject(err);
          }

          // key is a Buffer, that can be serialized however one desires
          const intPasswordHash = parseInt(passwordHash.toString('hex'), 16);
          const intAccountHash = parseInt(accountHash.toString('hex'), 16);

          // XOR the two keys together
          const xOrKey = intPasswordHash ^ intAccountHash;
          const key = xOrKey.toString(16);
          resolve(key);
        });
      });
    });
  })
}

function createLoginKey (password, accountKey, email) {
  // TODO
}

const password = 'MyPassIsSuperLongAndPrettyGreat';
const accountKey = '66491c59-484b-47d8-8375-e7b77d40367f';
const email = 'greg@schier.co';
const salt = '1o2n4pt403tn0q2';
const accountId = 'usr_120342085023lptyusrnistor';
console.time('KEY');
createEncryptionKey(password, email, accountKey, accountId, 'salt').then(key => {
  console.timeEnd('KEY');
  const msg = `
Hello World! This is a pretty long message, but not too bad.
Hello World! This is a pretty long message, but not too bad.
Hello World! This is a pretty long message, but not too bad.
Hello World! This is a pretty long message, but not too bad.
Hello World! This is a pretty long message, but not too bad.
Hello World! This is a pretty long message, but not too bad.
Hello World! This is a pretty long message, but not too bad.
Hello World! This is a pretty long message, but not too bad.
`;
  console.time('ENCRYPT');
  const e = encrypt(msg, key);
  const d = decrypt(e, key);
  console.timeEnd('ENCRYPT');

  console.log('SUCCESS?', d === msg);
});
