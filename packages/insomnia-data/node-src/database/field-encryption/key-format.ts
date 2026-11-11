import { createSecretKey } from 'node:crypto';

import type { FieldEncryptionKey } from './value';
import { assertFieldEncryptionKey } from './value';

const KEY_LENGTH_BYTES = 32;

/**
 * The two forms in which the local encryption key is handed to the user. Both are derived from the same JWK, so this is
 * the one place that defines them.
 */
export interface FieldEncryptionKeyExport {
  /** The key as JWK JSON text, e.g. `{"kty":"oct","k":"..."}`. This is what the exported file holds. */
  jwk: string;
  /**
   * The base64 of `jwk`. It is a single token without quotes or braces, so it can be pasted into a shell command or an
   * environment variable as it is.
   */
  base64: string;
}

export const exportFieldEncryptionKey = (key: FieldEncryptionKey): FieldEncryptionKeyExport => {
  assertFieldEncryptionKey(key);
  const jwk = JSON.stringify(key.export({ format: 'jwk' }));
  return { jwk, base64: Buffer.from(jwk, 'utf8').toString('base64') };
};

export const INVALID_KEY_MESSAGE =
  'Invalid encryption key: expected the base64 text from "Copy Key" or the JWK JSON from "Export Key" in the Insomnia preferences';

const BASE64_TEXT = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * The reverse of `exportFieldEncryptionKey()`: accepts either form it produces, the base64 text or the JWK JSON text,
 * with surrounding whitespace ignored. Throws an error whose message never contains any part of the input, because the
 * input is a secret and the message ends up in logs.
 */
export const parseFieldEncryptionKey = (text: string): FieldEncryptionKey => {
  const trimmed = text.trim();
  let jwk: unknown;
  try {
    if (trimmed.startsWith('{')) {
      jwk = JSON.parse(trimmed);
    } else if (BASE64_TEXT.test(trimmed)) {
      jwk = JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
    }
  } catch {
    // Not JSON: reported below. The parser's own message quotes part of the input, so it is not passed on.
  }
  const { kty, k } = (jwk ?? {}) as { kty?: unknown; k?: unknown };
  if (kty !== 'oct' || typeof k !== 'string') {
    throw new Error(INVALID_KEY_MESSAGE);
  }
  const keyBytes = Buffer.from(k, 'base64url');
  if (keyBytes.length !== KEY_LENGTH_BYTES) {
    throw new Error(`${INVALID_KEY_MESSAGE} (the key is not a 256-bit key)`);
  }
  return createSecretKey(keyBytes);
};
