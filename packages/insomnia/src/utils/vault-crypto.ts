import { type AESMessage, decryptAES, encryptAES } from '../account/crypt';

import { base64decode, base64encode } from './vault';

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
