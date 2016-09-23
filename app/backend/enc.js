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

function createKey (password, email, accountKey, accountId, salt) {
  return new Promise((resolve, reject) => {
    const KEY_LEN = 32;

    // 0. Sanitize the things
    password = prepareString(password);
    accountKey = prepareString(accountKey);
    email = prepareEmail(email);

    // 1. Generate salt using email
    new HKDF('sha512', salt, email).derive('info', 32, saltHash => {

      // 2. Generate intermediate key with salt
      crypto.pbkdf2(password, saltHash, 500000, KEY_LEN, 'sha512', (err, passwordHash) => {
        if (err) {
          return reject(err);
        }

        // 3. Generate another key from account key and account id
        new HKDF('sha512', accountKey, accountId).derive('info', KEY_LEN, accountHash => {
          if (err) {
            return reject(err);
          }

          // key is a Buffer, that can be serialized however one desires
          const intPasswordHash = parseInt(passwordHash.toString('hex'), 16);
          const intAccountHash = parseInt(accountHash.toString('hex'), 16);

          // 4. Generate final key by XORing the two generated keys together
          const xOrKey = intPasswordHash ^ intAccountHash;
          const key = xOrKey.toString(16);

          resolve(key);
        });
      });
    });
  })
}

const password = 'MyPassIsSuperLongAndPrettyGreat';
const accountKey = '66491c59-484b-47d8-8375-e7b77d40367f';
const email = 'greg@schier.co';
const salt = '1o2n4pt403tn0q2';
const accountId = 'usr_120342085023lptyusrnistor';

console.time('KEY');

createKey(password, email, accountKey, accountId, 'salt').then(key => {
  console.timeEnd('KEY');

  const msg = `Hello World! This is a pretty long message, but not too bad.`;

  console.time('ENCRYPT');
  const e = encrypt(msg, key);
  const d = decrypt(e, key);
  console.timeEnd('ENCRYPT');

  console.log('SUCCESS?', d === msg);
});
