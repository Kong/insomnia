import HKDF from 'hkdf';
import sjcl from 'sjcl';
import srp from 'srp';
import forge from 'node-forge';

const DEFAULT_BYTE_LENGTH = 32;
const DEFAULT_PBKDF2_ITERATIONS = 1E5; // 100,000

/**
 * Generate hex signing key used for AES encryption
 *
 * @param pass
 * @param email
 * @param salt
 */
export async function deriveKey (pass, email, salt) {
  const combinedSalt = await _hkdfSalt(salt, email);
  return _pbkdf2Passphrase(pass, combinedSalt);
}


/**
 * Encrypt data using symmetric key
 *
 * @param key key (hex encoded)
 * @param plaintext string of data to encrypt
 * @param additionalData any additional public data to attach
 * @returns {{iv, t, d, ad}}
 */
export function encryptAES (key, plaintext, additionalData) {
  const iv = forge.random.getBytesSync(12);
  const cipher = forge.cipher.createCipher('AES-GCM', forge.util.hexToBytes(key));

  cipher.start({additionalData, iv, tagLength: 128});
  cipher.update(forge.util.createBuffer(plaintext));
  cipher.finish();

  return {
    iv: forge.util.bytesToHex(iv),
    t: forge.util.bytesToHex(cipher.mode.tag),
    d: forge.util.bytesToHex(cipher.output),
    ad: forge.util.bytesToHex(additionalData)
  };
}


/**
 * Decrypt AES using a key
 *
 * @param key
 * @param message
 * @returns String
 */
export function decryptAES (key, message) {

  // ~~~~~~~~~~~~~~~~~~~~ //
  // Decrypt with AES-GCM //
  // ~~~~~~~~~~~~~~~~~~~~ //

  const decipher = forge.cipher.createDecipher(
    'AES-GCM',
    forge.util.hexToBytes(key)
  );

  decipher.start({
    iv: forge.util.hexToBytes(message.iv),
    tagLength: message.t.length * 4,
    tag: forge.util.hexToBytes(message.t),
    additionalData: forge.util.hexToBytes(message.ad)
  });

  decipher.update(forge.util.createBuffer(forge.util.hexToBytes(message.d)));

  if (decipher.finish()) {
    return decipher.output.toString()
  } else {
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Generate a random salt in hex
 *
 * @returns {string}
 */
export function getRandomHex (bytes = DEFAULT_BYTE_LENGTH) {
  return forge.util.bytesToHex(forge.random.getBytesSync(bytes));
}

/**
 * Generate a random account Id
 *
 * @returns {string}
 */
export function generateAccountId () {
  return `act_${getRandomHex(DEFAULT_BYTE_LENGTH)}`;
}

/**
 * Generate a random key
 *
 * @returns {Promise}
 */
export function srpGenKey () {
  return new Promise((resolve, reject) => {
    srp.genKey((err, secret1Buffer) => {
      if (err) {
        reject(err);
      } else {
        resolve(secret1Buffer.toString('hex'))
      }
    });
  })
}

/**
 * Generate RSA keypair JWK with 2048 bits and exponent 0x10001
 *
 * @returns Object
 */
export async function generateKeyPairJWK () {
  // NOTE: Safari has crypto.webkitSubtle, but does not support RSA-OAEP-SHA256
  const subtle = window.crypto && window.crypto.subtle;

  if (subtle) {
    console.log('-- Using Native RSA Generation --');

    const pair = await subtle.generateKey({
        name: 'RSA-OAEP',
        publicExponent: new Uint8Array([1, 0, 1]),
        modulusLength: 2048,
        hash: 'SHA-256'
      },
      true,
      ['encrypt', 'decrypt']
    );

    return {
      publicKey: await subtle.exportKey('jwk', pair.publicKey),
      privateKey: await subtle.exportKey('jwk', pair.privateKey)
    };
  } else {
    console.log('-- Using Forge RSA Generation --');

    const pair = forge.pki.rsa.generateKeyPair({bits: 2048, e: 0x10001});
    const privateKey = {
      alg: 'RSA-OAEP-256',
      kty: 'RSA',
      key_ops: ['decrypt'],
      ext: true,
      d: _bigIntToB64Url(pair.privateKey.d),
      dp: _bigIntToB64Url(pair.privateKey.dP),
      dq: _bigIntToB64Url(pair.privateKey.dQ),
      e: _bigIntToB64Url(pair.privateKey.e),
      n: _bigIntToB64Url(pair.privateKey.n),
      p: _bigIntToB64Url(pair.privateKey.p),
      q: _bigIntToB64Url(pair.privateKey.q),
      qi: _bigIntToB64Url(pair.privateKey.qInv)
    };

    const publicKey = {
      alg: 'RSA-OAEP-256',
      kty: 'RSA',
      key_ops: ['encrypt'],
      e: _bigIntToB64Url(pair.publicKey.e),
      n: _bigIntToB64Url(pair.publicKey.n),
    };

    return {privateKey, publicKey};
  }
}


// ~~~~~~~~~~~~~~~~ //
// Helper Functions //
// ~~~~~~~~~~~~~~~~ //

/**
 * Combine email and raw salt into usable salt
 *
 * @param rawSalt
 * @param rawEmail
 * @returns {Promise}
 */
function _hkdfSalt (rawSalt, rawEmail) {
  return new Promise(resolve => {
    const hkdf = new HKDF('sha256', rawSalt, rawEmail);
    hkdf.derive('', DEFAULT_BYTE_LENGTH, buffer => resolve(buffer.toString('hex')));
  })
}

/**
 * Convert a JSBN BigInteger to a URL-safe version of base64 encoding. This
 * should only be used for encoding JWKs
 *
 * @param n BigInteger
 * @returns {string}
 */
function _bigIntToB64Url (n) {
  const bytes = forge.util.binary.hex.decode(n.toString(16));
  return forge.util.binary.base64.encode(bytes)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Derive key from password
 *
 * @param passphrase
 * @param salt hex representation of salt
 */
async function _pbkdf2Passphrase (passphrase, salt) {
  if (window.crypto && window.crypto.subtle) {
    console.log('-- Using native PBKDF2 --');

    const k = await window.crypto.subtle.importKey(
      'raw',
      Buffer.from(passphrase, 'utf8'),
      {name: 'PBKDF2'},
      true,
      ['deriveBits']
    );

    const algo = {
      name: 'PBKDF2',
      salt: new Buffer(salt, 'hex'),
      iterations: DEFAULT_PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    };

    const derivedKeyRaw = await window.crypto.subtle.deriveBits(algo, k, DEFAULT_BYTE_LENGTH * 8);
    return new Buffer(derivedKeyRaw).toString('hex');
  } else {
    console.log('-- Using SJCL PBKDF2 --');

    const derivedKeyRaw = sjcl.misc.pbkdf2(
      passphrase,
      sjcl.codec.hex.toBits(salt),
      DEFAULT_PBKDF2_ITERATIONS,
      DEFAULT_BYTE_LENGTH * 8,
      sjcl.hash.sha1
    );

    return sjcl.codec.hex.fromBits(derivedKeyRaw);

    // NOTE: SJCL (above) is about 10x faster than Forge
    // const derivedKeyRaw = forge.pkcs5.pbkdf2(
    //   passphrase,
    //   forge.util.hexToBytes(salt),
    //   DEFAULT_PBKDF2_ITERATIONS,
    //   DEFAULT_BYTE_LENGTH,
    //   forge.md.sha256.create()
    // );
    // const derivedKey = forge.util.bytesToHex(derivedKeyRaw);
  }
}
