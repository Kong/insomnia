import { createSecretKey, generateKeySync, randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  assertFieldEncryptionKey,
  decryptValue,
  ENCRYPTED_VALUE_PREFIX,
  encryptValue,
  isWellFormedCiphertext,
} from './value';

const key = generateKeySync('aes', { length: 256 });
const b64 = (bytes: number) => randomBytes(bytes).toString('base64');

describe('encryptValue() / decryptValue()', () => {
  it('round-trips, including empty-looking, unicode and large strings', () => {
    for (const plaintext of ['secret', ' ', 'p@ss wörd 🔑 日本語', 'x'.repeat(3_000_000)]) {
      expect(decryptValue(key, encryptValue(key, plaintext))).toBe(plaintext);
    }
  });

  it('uses the compact v1 format: prefix + base64(iv(12) || tag(16) || ciphertext)', () => {
    const encrypted = encryptValue(key, 'hello');
    expect(encrypted.startsWith('enc:insomnia:v1:')).toBe(true);
    const payload = Buffer.from(encrypted.slice(ENCRYPTED_VALUE_PREFIX.length), 'base64');
    expect(payload.length).toBe(12 + 16 + Buffer.byteLength('hello'));
    // JSON-safe: only the base64 alphabet after the prefix
    expect(encrypted.slice(ENCRYPTED_VALUE_PREFIX.length)).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(JSON.stringify(encrypted)).toBe(`"${encrypted}"`);
  });

  it('uses a fresh random IV for every value', () => {
    expect(encryptValue(key, 'same')).not.toBe(encryptValue(key, 'same'));
  });

  it('replaces a lone surrogate with U+FFFD (known, accepted gap)', () => {
    expect(decryptValue(key, encryptValue(key, 'a\uD800b'))).toBe('a�b');
  });

  it('throws with the wrong key', () => {
    const otherKey = generateKeySync('aes', { length: 256 });
    expect(() => decryptValue(otherKey, encryptValue(key, 'secret'))).toThrow();
  });

  it('throws when the ciphertext, tag or IV is tampered with', () => {
    const encrypted = encryptValue(key, 'secret value');
    const payload = Buffer.from(encrypted.slice(ENCRYPTED_VALUE_PREFIX.length), 'base64');
    for (const offset of [0, 12, 28]) {
      const tampered = Buffer.from(payload);
      tampered[offset] ^= 0x01;
      expect(() => decryptValue(key, ENCRYPTED_VALUE_PREFIX + tampered.toString('base64'))).toThrow();
    }
  });

  it('throws for values that are not well-formed ciphertext', () => {
    expect(() => decryptValue(key, 'plain')).toThrow();
    expect(() => decryptValue(key, `${ENCRYPTED_VALUE_PREFIX}${b64(27)}`)).toThrow();
  });
});

describe('isWellFormedCiphertext()', () => {
  it('accepts real ciphertext', () => {
    expect(isWellFormedCiphertext(encryptValue(key, 'a'))).toBe(true);
    expect(isWellFormedCiphertext(encryptValue(key, 'a'.repeat(1000)))).toBe(true);
  });

  it('requires the prefix', () => {
    expect(isWellFormedCiphertext(b64(30))).toBe(false);
    expect(isWellFormedCiphertext(`enc:${b64(30)}`)).toBe(false);
    expect(isWellFormedCiphertext(`enc:insomnia:v2:${b64(30)}`)).toBe(false);
  });

  it('requires at least 28 decoded bytes (12-byte IV + 16-byte tag)', () => {
    expect(isWellFormedCiphertext(`${ENCRYPTED_VALUE_PREFIX}${b64(28)}`)).toBe(true);
    expect(isWellFormedCiphertext(`${ENCRYPTED_VALUE_PREFIX}${b64(27)}`)).toBe(false);
    expect(isWellFormedCiphertext(`${ENCRYPTED_VALUE_PREFIX}${b64(1)}`)).toBe(false);
    expect(isWellFormedCiphertext(ENCRYPTED_VALUE_PREFIX)).toBe(false);
  });

  it('requires valid standard base64: alphabet, length multiple of 4, correct padding', () => {
    const valid = b64(30); // 40 chars, no padding
    expect(valid.length % 4).toBe(0);
    expect(isWellFormedCiphertext(`${ENCRYPTED_VALUE_PREFIX}${valid}`)).toBe(true);
    // wrong length
    expect(isWellFormedCiphertext(`${ENCRYPTED_VALUE_PREFIX}${valid}A`)).toBe(false);
    expect(isWellFormedCiphertext(`${ENCRYPTED_VALUE_PREFIX}${valid.slice(0, -1)}`)).toBe(false);
    // characters outside the alphabet (url-safe base64, whitespace, punctuation)
    expect(isWellFormedCiphertext(`${ENCRYPTED_VALUE_PREFIX}${valid.slice(0, -4)}-_AA`)).toBe(false);
    expect(isWellFormedCiphertext(`${ENCRYPTED_VALUE_PREFIX}${valid.slice(0, -4)} AAA`)).toBe(false);
    expect(isWellFormedCiphertext(`${ENCRYPTED_VALUE_PREFIX}${valid}\n`)).toBe(false);
    // padding only at the end, at most two
    expect(isWellFormedCiphertext(`${ENCRYPTED_VALUE_PREFIX}${valid.slice(0, 8)}=${valid.slice(9)}`)).toBe(false);
    expect(isWellFormedCiphertext(`${ENCRYPTED_VALUE_PREFIX}${valid.slice(0, -3)}===`)).toBe(false);
  });

  it('handles padded base64', () => {
    // 29 bytes -> 40 chars with "=" padding (29 % 3 === 2)
    const padded = b64(29);
    expect(padded.endsWith('=')).toBe(true);
    expect(isWellFormedCiphertext(`${ENCRYPTED_VALUE_PREFIX}${padded}`)).toBe(true);
    // 28 bytes -> "==" or "=" depending on length; 28 % 3 === 1 -> "=="
    expect(b64(28).endsWith('==')).toBe(true);
  });

  it('does not overflow the stack on multi-megabyte values', () => {
    expect(isWellFormedCiphertext(`${ENCRYPTED_VALUE_PREFIX}${b64(6_000_000)}`)).toBe(true);
  });
});

describe('assertFieldEncryptionKey()', () => {
  it('accepts a 256-bit secret key', () => {
    expect(() => assertFieldEncryptionKey(key)).not.toThrow();
  });

  it('rejects other key sizes', () => {
    expect(() => assertFieldEncryptionKey(createSecretKey(randomBytes(16)))).toThrow();
    expect(() => assertFieldEncryptionKey(createSecretKey(randomBytes(64)))).toThrow();
  });

  it('rejects non-keys', () => {
    expect(() => assertFieldEncryptionKey(undefined as never)).toThrow();
    expect(() => assertFieldEncryptionKey('key' as never)).toThrow();
  });
});
