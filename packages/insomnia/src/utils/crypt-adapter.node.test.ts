import { describe, expect, it } from 'vitest';

import { decryptSecretValue, encryptSecretValue } from './crypt-adapter.node';

const TEST_AES_KEY: JsonWebKey = {
  kty: 'oct',
  alg: 'A256GCM',
  ext: true,
  key_ops: ['encrypt', 'decrypt'],
  k: '5hs1f2xuiNPHUp11i6SWlsqYpWe_hWPcEKucZlwBfFE',
};

describe('encryptSecretValue', () => {
  it('returns rawValue when symmetricKey is not an object', async () => {
    expect(await encryptSecretValue('secret', 'invalid' as unknown as JsonWebKey)).toBe('secret');
  });

  it('returns rawValue when symmetricKey is empty object', async () => {
    expect(await encryptSecretValue('secret', {})).toBe('secret');
  });

  it('encrypts the value with a valid key', async () => {
    const encrypted = await encryptSecretValue('my secret', TEST_AES_KEY);
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toBe('my secret');
  });
});

describe('decryptSecretValue', () => {
  it('returns encryptedValue when symmetricKey is not an object', async () => {
    expect(await decryptSecretValue('encrypted', 'invalid' as unknown as JsonWebKey)).toBe('encrypted');
  });

  it('returns encryptedValue when symmetricKey is empty object', async () => {
    expect(await decryptSecretValue('encrypted', {})).toBe('encrypted');
  });

  it('round-trips encrypt then decrypt', async () => {
    const encrypted = await encryptSecretValue('my secret', TEST_AES_KEY);
    expect(await decryptSecretValue(encrypted, TEST_AES_KEY)).toBe('my secret');
  });
});
