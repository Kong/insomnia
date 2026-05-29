// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { decryptSecretValue, encryptSecretValue } from './vault-crypto';

const TEST_AES_KEY: JsonWebKey = {
  kty: 'oct',
  alg: 'A256GCM',
  ext: true,
  key_ops: ['encrypt', 'decrypt'],
  k: '5hs1f2xuiNPHUp11i6SWlsqYpWe_hWPcEKucZlwBfFE',
};

describe('encryptSecretValue', () => {
  it('returns rawValue when symmetricKey is not an object', () => {
    expect(encryptSecretValue('secret', 'invalid' as unknown as JsonWebKey)).toBe('secret');
  });

  it('returns rawValue when symmetricKey is empty object', () => {
    expect(encryptSecretValue('secret', {})).toBe('secret');
  });

  it('encrypts the value with a valid key', () => {
    const encrypted = encryptSecretValue('my secret', TEST_AES_KEY);
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toBe('my secret');
  });

  it('returns original value when encryption fails', () => {
    // Use an invalid key format
    const invalidKey = { kty: 'oct', k: 'invalid' };
    const encrypted = encryptSecretValue('my secret', invalidKey as unknown as JsonWebKey);
    expect(encrypted).toBe('my secret');
  });
});

describe('decryptSecretValue', () => {
  it('returns encryptedValue when symmetricKey is not an object', () => {
    expect(decryptSecretValue('encrypted', 'invalid' as unknown as JsonWebKey)).toBe('encrypted');
  });

  it('returns encryptedValue when symmetricKey is empty object', () => {
    expect(decryptSecretValue('encrypted', {})).toBe('encrypted');
  });

  it('round-trips encrypt then decrypt', () => {
    const plaintext = 'my secret value';
    const encrypted = encryptSecretValue(plaintext, TEST_AES_KEY);
    const decrypted = decryptSecretValue(encrypted, TEST_AES_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it('returns original value when decryption fails', () => {
    // Use an invalid encrypted value
    const encrypted = encryptSecretValue('my secret', TEST_AES_KEY);
    // Try to decrypt with wrong key
    const wrongKey = {
      kty: 'oct',
      alg: 'A256GCM',
      k: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    };
    const result = decryptSecretValue(encrypted, wrongKey);
    expect(result).toBe(encrypted);
  });

  it('handles special characters in plaintext', () => {
    const plaintext = 'special chars: !@#$%^&*()_+-=[]{}|;:,.<>?/~`';
    const encrypted = encryptSecretValue(plaintext, TEST_AES_KEY);
    const decrypted = decryptSecretValue(encrypted, TEST_AES_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it('handles unicode characters in plaintext', () => {
    const plaintext = 'unicode: 你好世界 🚀 مرحبا العالم';
    const encrypted = encryptSecretValue(plaintext, TEST_AES_KEY);
    const decrypted = decryptSecretValue(encrypted, TEST_AES_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it('handles empty string', () => {
    const plaintext = '';
    const encrypted = encryptSecretValue(plaintext, TEST_AES_KEY);
    const decrypted = decryptSecretValue(encrypted, TEST_AES_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it('handles large plaintext', () => {
    const plaintext = 'x'.repeat(10000);
    const encrypted = encryptSecretValue(plaintext, TEST_AES_KEY);
    const decrypted = decryptSecretValue(encrypted, TEST_AES_KEY);
    expect(decrypted).toBe(plaintext);
  });
});
