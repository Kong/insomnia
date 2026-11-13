import { createSecretKey, generateKeySync } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { exportFieldEncryptionKey, getFieldEncryptionKeyHost } from './key-format';
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

  it('records the machine name as a custom JWK member in both forms, and nothing without one', () => {
    const { jwk, base64 } = exportFieldEncryptionKey(key, 'WEI-PC');
    expect(JSON.parse(jwk)).toEqual({
      'kty': 'oct',
      'k': key.export().toString('base64url'),
      'x-insomnia-host': 'WEI-PC',
    });
    expect(Buffer.from(base64, 'base64').toString('utf8')).toBe(jwk);
    expect(JSON.parse(exportFieldEncryptionKey(key, '').jwk)).not.toHaveProperty('x-insomnia-host');
  });
});

describe('getFieldEncryptionKeyHost()', () => {
  it.each(['jwk', 'base64'] as const)('gives the machine name the key was exported with, from the %s form', form => {
    expect(getFieldEncryptionKeyHost(exportFieldEncryptionKey(key, 'WEI-PC')[form])).toBe('WEI-PC');
  });

  it('gives undefined for a key without a machine name', () => {
    expect(getFieldEncryptionKeyHost(exportFieldEncryptionKey(key).jwk)).toBeUndefined();
    expect(getFieldEncryptionKeyHost(exportFieldEncryptionKey(key).base64)).toBeUndefined();
  });

  it.each(['', 'not a key', '[]', '{"x-insomnia-host":5}', '{"x-insomnia-host":""}', '{"x-insomnia-host":'])(
    'gives undefined, and does not throw, for %j',
    text => {
      expect(getFieldEncryptionKeyHost(text)).toBeUndefined();
    },
  );
});
