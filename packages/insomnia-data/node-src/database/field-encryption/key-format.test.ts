import { createSecretKey, generateKeySync } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { exportFieldEncryptionKey } from './key-format';
import { decryptValue, encryptValue } from './value';

const key = generateKeySync('aes', { length: 256 });

describe('exportFieldEncryptionKey()', () => {
  it('gives the key as JWK JSON text', () => {
    const { jwk } = exportFieldEncryptionKey(key);
    expect(JSON.parse(jwk)).toEqual({ kty: 'oct', k: key.export().toString('base64url') });
  });

  it('gives the base64 of that text, as one token that needs no quoting in a shell', () => {
    const { jwk, base64 } = exportFieldEncryptionKey(key);
    expect(Buffer.from(base64, 'base64').toString('utf8')).toBe(jwk);
    expect(base64).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });

  it('gives the same output for the same key', () => {
    expect(exportFieldEncryptionKey(key)).toEqual(exportFieldEncryptionKey(createSecretKey(key.export())));
  });

  it.each(['jwk', 'base64'] as const)('can be turned back into the key it came from through the %s form', form => {
    const exported = exportFieldEncryptionKey(key);
    const jwkText = form === 'jwk' ? exported.jwk : Buffer.from(exported.base64, 'base64').toString('utf8');
    const restored = createSecretKey(Buffer.from(JSON.parse(jwkText).k, 'base64url'));

    expect(restored.equals(key)).toBe(true);
    expect(decryptValue(restored, encryptValue(key, 'secret'))).toBe('secret');
  });

  it('refuses something that is not a 256-bit secret key', () => {
    expect(() => exportFieldEncryptionKey(generateKeySync('aes', { length: 128 }))).toThrow('256-bit');
    expect(() => exportFieldEncryptionKey(undefined as never)).toThrow('256-bit');
  });
});
