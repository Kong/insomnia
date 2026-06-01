import { type AESMessage, decryptAES, encryptAES } from '../account/crypt';
import { base64decode, base64encode } from './vault';

export const encryptSecretValue = async (rawValue: string, symmetricKey: JsonWebKey): Promise<string> => {
  if (typeof symmetricKey !== 'object' || Object.keys(symmetricKey).length === 0) {
    return rawValue;
  }
  try {
    const encryptResult = encryptAES(symmetricKey, rawValue);
    return base64encode(encryptResult);
  } catch {
    return rawValue;
  }
};

export const decryptSecretValue = async (encryptedValue: string, symmetricKey: JsonWebKey): Promise<string> => {
  if (typeof symmetricKey !== 'object' || Object.keys(symmetricKey).length === 0) {
    return encryptedValue;
  }
  try {
    const jsonWebKey = base64decode(encryptedValue, true) as AESMessage;
    return decryptAES(symmetricKey, jsonWebKey);
  } catch {
    return encryptedValue;
  }
};
