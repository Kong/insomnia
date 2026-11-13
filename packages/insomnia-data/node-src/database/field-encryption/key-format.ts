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

/**
 * Name of the custom JWK member that records the machine the key was exported on. JWK allows members of any name, and
 * the parser below only reads `kty` and `k`.
 */
const HOST_MEMBER = 'x-insomnia-host';

/**
 * `host` is the name of the machine the key belongs to. It is written into the key, so that a tool that is given the
 * key on another machine can tell the user (see `getFieldEncryptionKeyHost()`).
 */
export const exportFieldEncryptionKey = (key: FieldEncryptionKey, host?: string): FieldEncryptionKeyExport => {
  assertFieldEncryptionKey(key);
  const jwk = JSON.stringify({ ...key.export({ format: 'jwk' }), ...(host ? { [HOST_MEMBER]: host } : {}) });
  return { jwk, base64: Buffer.from(jwk, 'utf8').toString('base64') };
};

export const INVALID_KEY_MESSAGE =
  'Invalid encryption key: expected the base64 text from "Copy Key" or the JWK JSON from "Export Key" in the Insomnia preferences';

const BASE64_TEXT = /^[A-Za-z0-9+/]+={0,2}$/;

/** The members of the JWK in either form, or an empty object when the text is neither form. */
const readJwk = (text: string): { kty?: unknown; k?: unknown; [HOST_MEMBER]?: unknown } => {
  const trimmed = text.trim();
  let jwk: unknown;
  try {
    if (trimmed.startsWith('{')) {
      jwk = JSON.parse(trimmed);
    } else if (BASE64_TEXT.test(trimmed)) {
      jwk = JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
    }
  } catch {
    // Not JSON: the callers report it. The parser's own message quotes part of the input, so it is not passed on.
  }
  return typeof jwk === 'object' && jwk !== null ? jwk : {};
};

/**
 * The name of the machine the key was exported on, or undefined when the text records none or is not a key. Never
 * throws: the key itself is checked by `parseFieldEncryptionKey()`.
 */
export const getFieldEncryptionKeyHost = (text: string): string | undefined => {
  const host = readJwk(text)[HOST_MEMBER];
  return typeof host === 'string' && host !== '' ? host : undefined;
};

/**
 * Whether two machine names are the same machine. Case does not count. A name without a domain matches the first label
 * of a name with one: the same Mac is `Wei-Mac` or `Wei-Mac.local` depending on the network. Two names that both have
 * dots are compared whole, so two IP addresses or `db.prod.example.com` and `db.staging.example.com` stay different.
 */
export const isSameHost = (a: string, b: string) => {
  const [x, y] = [a, b].map(host => host.trim().toLowerCase());
  if (x === y) {
    return true;
  }
  const [shorter, longer] = x.length <= y.length ? [x, y] : [y, x];
  return !shorter.includes('.') && longer.split('.')[0] === shorter;
};

/**
 * The reverse of `exportFieldEncryptionKey()`: accepts either form it produces, the base64 text or the JWK JSON text,
 * with surrounding whitespace ignored. Throws an error whose message never contains any part of the input, because the
 * input is a secret and the message ends up in logs.
 */
export const parseFieldEncryptionKey = (text: string): FieldEncryptionKey => {
  const { kty, k } = readJwk(text);
  if (kty !== 'oct' || typeof k !== 'string') {
    throw new Error(INVALID_KEY_MESSAGE);
  }
  const keyBytes = Buffer.from(k, 'base64url');
  if (keyBytes.length !== KEY_LENGTH_BYTES) {
    throw new Error(`${INVALID_KEY_MESSAGE} (the key is not a 256-bit key)`);
  }
  return createSecretKey(keyBytes);
};
