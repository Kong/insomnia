import 'node-forge/lib/util';
import 'node-forge/lib/cipher';
import 'node-forge/lib/cipherModes';
import 'node-forge/lib/aes';

import forge from 'node-forge/lib/forge';

import type { AESMessage } from '../account/crypt';

const base64encode = (input: string | object) => {
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
  const binary = atob(btoa(unescape(encodeURIComponent(inputStr))));
  return btoa(binary);
};

const base64decode = (base64Str: string, toObject: boolean = false) => {
  try {
    const decodedStr = decodeURIComponent(escape(atob(base64Str)));
    if (toObject) {
      return JSON.parse(decodedStr);
    }
    return decodedStr;
  } catch {
    console.error(`failed to base64 decode string ${base64Str}`);
  }
  return base64Str;
};

const b64UrlToHex = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return forge.util.bytesToHex(atob(base64));
};

const getKeyBytes = (symmetricKey: JsonWebKey) => forge.util.hexToBytes(b64UrlToHex(symmetricKey.k || ''));

const getRandomIv = () => {
  const iv = new Uint8Array(12);
  window.crypto.getRandomValues(iv);
  return String.fromCodePoint(...iv);
};

const createForgeCipher = forge.cipher.createCipher.bind(forge.cipher);
const createForgeDecipher = forge.cipher.createDecipher.bind(forge.cipher);

const encryptAES = (symmetricKey: JsonWebKey, plaintext: string): AESMessage => {
  const cipher = createForgeCipher('AES-GCM', getKeyBytes(symmetricKey));
  const iv = getRandomIv();
  const encodedPlaintext = encodeURIComponent(plaintext);
  cipher.start({
    iv,
    tagLength: 128,
  });
  cipher.update(forge.util.createBuffer(encodedPlaintext));
  cipher.finish();
  return {
    iv: forge.util.bytesToHex(iv),
    t: forge.util.bytesToHex(cipher.mode.tag.bytes()),
    ad: '',
    d: forge.util.bytesToHex(cipher.output.bytes()),
  };
};

const decryptAES = (symmetricKey: JsonWebKey, encryptedValue: AESMessage) => {
  const decipher = createForgeDecipher('AES-GCM', getKeyBytes(symmetricKey));
  decipher.start({
    iv: forge.util.hexToBytes(encryptedValue.iv),
    tagLength: encryptedValue.t.length * 4,
    tag: forge.util.createBuffer(forge.util.hexToBytes(encryptedValue.t)),
    additionalData: forge.util.hexToBytes(encryptedValue.ad),
  });
  decipher.update(forge.util.createBuffer(forge.util.hexToBytes(encryptedValue.d)));
  if (!decipher.finish()) {
    throw new Error('Failed to decrypt data');
  }
  return decodeURIComponent(decipher.output.toString());
};

export const encryptSecretValue = (rawValue: string, symmetricKey: JsonWebKey) => {
  if (typeof symmetricKey !== 'object' || Object.keys(symmetricKey).length === 0) {
    // invalid symmetricKey
    return rawValue;
  }
  try {
    const encryptResult = encryptAES(symmetricKey, rawValue);
    const encryptedValue = base64encode(encryptResult);
    return encryptedValue;
  } catch {
    // return original value if encryption fails
    return rawValue;
  }
};

export const decryptSecretValue = (encryptedValue: string, symmetricKey: JsonWebKey) => {
  if (typeof symmetricKey !== 'object' || Object.keys(symmetricKey).length === 0) {
    // invalid symmetricKey
    return encryptedValue;
  }
  try {
    const jsonWebKey = base64decode(encryptedValue, true) as AESMessage;
    return decryptAES(symmetricKey, jsonWebKey);
  } catch {
    // return origin value if failed to decrypt
    return encryptedValue;
  }
};
