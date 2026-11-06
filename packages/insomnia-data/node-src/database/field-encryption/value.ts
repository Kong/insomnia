import { createCipheriv, createDecipheriv, type KeyObject, randomBytes } from 'node:crypto';

/** AES-256 secret key, created once when the key is loaded and reused for every value. */
export type FieldEncryptionKey = KeyObject;

export const ENCRYPTED_VALUE_PREFIX = 'enc:insomnia:v1:';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const MIN_PAYLOAD_LENGTH = IV_LENGTH + TAG_LENGTH;

// Deliberately not a grouped `(?:[A-Za-z0-9+/]{4})*` pattern: values such as RequestVersion.compressedRequest can be megabytes
const BASE64_CHARS = /^[A-Za-z0-9+/]*={0,2}$/;

export const assertFieldEncryptionKey = (key: FieldEncryptionKey) => {
  if (key?.type !== 'secret' || key.symmetricKeySize !== KEY_LENGTH) {
    throw new Error('Field encryption key must be a 256-bit secret KeyObject');
  }
};

/** Cheap prefix check only. It does not make a value ciphertext; see `isWellFormedCiphertext`. */
export const hasEncryptedValuePrefix = (value: string) => value.startsWith(ENCRYPTED_VALUE_PREFIX);

/**
 * Whether the part after the prefix is valid standard base64 (length a multiple of 4, correct padding) that decodes to at least
 * 28 bytes (12-byte IV + 16-byte tag). This is the format half of "counts as ciphertext"; the other half, being on an encrypted
 * field path, is checked by the caller.
 */
export const isWellFormedCiphertext = (value: string) => {
  if (!hasEncryptedValuePrefix(value)) {
    return false;
  }
  const payload = value.slice(ENCRYPTED_VALUE_PREFIX.length);
  if (payload.length % 4 !== 0 || !BASE64_CHARS.test(payload)) {
    return false;
  }
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return (payload.length / 4) * 3 - padding >= MIN_PAYLOAD_LENGTH;
};

// Known gap, accepted: a string with a lone UTF-16 surrogate (e.g. '\ud800') does not survive the UTF-8 round
// trip and decrypts with U+FFFD in its place. Real secrets practically never contain one, so it is not detected or handled.
export const encryptValue = (key: FieldEncryptionKey, plaintext: string) => {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ENCRYPTED_VALUE_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
};

/** Throws on a wrong key, a failed authentication tag, or a value that is not well-formed ciphertext. */
export const decryptValue = (key: FieldEncryptionKey, value: string) => {
  if (!isWellFormedCiphertext(value)) {
    throw new Error('Value is not well-formed field ciphertext');
  }
  const payload = Buffer.from(value.slice(ENCRYPTED_VALUE_PREFIX.length), 'base64');
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, MIN_PAYLOAD_LENGTH);
  const ciphertext = payload.subarray(MIN_PAYLOAD_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
};
