import type { FieldEncryptionKey } from './value';
import { assertFieldEncryptionKey } from './value';

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
    // Not JSON: there is nothing to read
  }
  return typeof jwk === 'object' && jwk !== null ? jwk : {};
};

/**
 * The name of the machine the key was exported on, or undefined when the text records none or is not a key. Never
 * throws: it does not check that the text is a valid key.
 */
export const getFieldEncryptionKeyHost = (text: string): string | undefined => {
  const host = readJwk(text)[HOST_MEMBER];
  return typeof host === 'string' && host !== '' ? host : undefined;
};
