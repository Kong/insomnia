import { createSecretKey, generateKeySync, randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  exportFieldEncryptionKey,
  getFieldEncryptionKeyHost,
  INVALID_KEY_MESSAGE,
  isSameHost,
  parseFieldEncryptionKey,
} from './key-format';
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

  it('does not stop the key from being read', () => {
    expect(parseFieldEncryptionKey(exportFieldEncryptionKey(key, 'WEI-PC').jwk).equals(key)).toBe(true);
    expect(parseFieldEncryptionKey(exportFieldEncryptionKey(key, 'WEI-PC').base64).equals(key)).toBe(true);
  });
});

describe('isSameHost()', () => {
  it.each([
    ['WEI-PC', 'wei-pc'],
    ['Weis-MacBook.local', 'Weis-MacBook'],
    ['build-1.corp.example.com', 'build-1'],
    [' wei-pc ', 'wei-pc'],
  ])('treats %s and %s as the same machine', (a, b) => {
    expect(isSameHost(a, b)).toBe(true);
    expect(isSameHost(b, a)).toBe(true);
  });

  it.each([
    ['WEI-PC', 'WEI-LAPTOP'],
    ['build-1.example.com', 'build-2.example.com'],
    ['wei', 'wei2'],
    ['192.168.1.5', '192.168.2.7'],
    ['db.prod.example.com', 'db.staging.example.com'],
    ['', 'wei'],
  ])('treats %s and %s as different machines', (a, b) => {
    expect(isSameHost(a, b)).toBe(false);
  });
});

describe('parseFieldEncryptionKey()', () => {
  const { jwk, base64 } = exportFieldEncryptionKey(key);

  it.each([
    ['the base64 text', base64],
    ['the JWK JSON text', jwk],
    ['the base64 text with a trailing newline', `${base64}\n`],
    ['the JWK JSON of a file with a byte order mark and a newline', `\uFEFF${jwk}\r\n`],
    ['pretty-printed JWK JSON', JSON.stringify(JSON.parse(jwk), null, 2)],
  ])('gives back the key from %s', (_, text) => {
    const parsed = parseFieldEncryptionKey(text);
    expect(parsed.equals(key)).toBe(true);
    expect(decryptValue(parsed, encryptValue(key, 'secret'))).toBe('secret');
  });

  it('is the reverse of exportFieldEncryptionKey() for both forms', () => {
    for (let i = 0; i < 20; i++) {
      const other = generateKeySync('aes', { length: 256 });
      const exported = exportFieldEncryptionKey(other);
      expect(parseFieldEncryptionKey(exported.base64).equals(other)).toBe(true);
      expect(parseFieldEncryptionKey(exported.jwk).equals(other)).toBe(true);
    }
  });

  const jwkOf = (fields: object) => JSON.stringify(fields);
  const shortKey = randomBytes(16).toString('base64url');

  it.each([
    ['an empty string', ''],
    ['whitespace', '  \n'],
    ['text that is neither form', 'not a key at all'],
    ['base64 of something that is not JSON', Buffer.from('plain text').toString('base64')],
    ['base64 of JSON that is not a JWK', Buffer.from('{"a":1}').toString('base64')],
    ['base64 of a JSON array', Buffer.from('[1,2]').toString('base64')],
    ['broken JSON', '{"kty":"oct","k":'],
    ['JSON of something else', '[]'],
    ['a JWK of another key type', jwkOf({ kty: 'RSA', k: key.export().toString('base64url') })],
    ['a JWK without k', jwkOf({ kty: 'oct' })],
    ['a JWK whose k is not a string', jwkOf({ kty: 'oct', k: 5 })],
  ])('rejects %s', (_, text) => {
    expect(() => parseFieldEncryptionKey(text)).toThrow(INVALID_KEY_MESSAGE);
  });

  it.each([
    ['empty', ''],
    ['128-bit', shortKey],
    ['512-bit', randomBytes(64).toString('base64url')],
  ])('rejects a JWK whose key is %s, in either form', (_, k) => {
    const text = jwkOf({ kty: 'oct', k });
    expect(() => parseFieldEncryptionKey(text)).toThrow('not a 256-bit key');
    expect(() => parseFieldEncryptionKey(Buffer.from(text).toString('base64'))).toThrow('not a 256-bit key');
  });

  it('never puts any part of the input into the error message', () => {
    const secret = 'SuperSecretValue123';
    for (const text of [
      secret,
      `{"kty":"oct","k":"${secret}`,
      jwkOf({ kty: 'oct', k: secret }),
      Buffer.from(`{"kty":"oct","k":"${secret}`).toString('base64'),
      Buffer.from(jwkOf({ kty: 'oct', k: secret })).toString('base64'),
    ]) {
      let message = '';
      try {
        parseFieldEncryptionKey(text);
      } catch (error) {
        message = String((error as Error).message) + String((error as Error).cause ?? '');
      }
      expect(message).not.toBe('');
      expect(message).not.toContain(secret);
      expect(message).not.toContain(Buffer.from(secret).toString('base64').slice(0, 12));
    }
  });
});
