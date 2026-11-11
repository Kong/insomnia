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

export const exportFieldEncryptionKey = (key: FieldEncryptionKey): FieldEncryptionKeyExport => {
  assertFieldEncryptionKey(key);
  const jwk = JSON.stringify(key.export({ format: 'jwk' }));
  return { jwk, base64: Buffer.from(jwk, 'utf8').toString('base64') };
};
