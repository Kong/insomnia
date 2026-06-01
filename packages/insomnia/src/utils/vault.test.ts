// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { base64decode, base64encode, decryptVaultKeyFromSession } from './vault';

vi.mock('../models/settings', () => ({
  getOrCreate: vi.fn(),
}));

const TEST_AES_KEY: JsonWebKey = {
  kty: 'oct',
  alg: 'A256GCM',
  ext: true,
  key_ops: ['encrypt', 'decrypt'],
  k: '5hs1f2xuiNPHUp11i6SWlsqYpWe_hWPcEKucZlwBfFE',
};

const mockSecretStorage = {
  decryptString: vi.fn(),
  setSecret: vi.fn(),
  getSecret: vi.fn(),
  deleteSecret: vi.fn(),
};

(window as any).main = { secretStorage: mockSecretStorage };

describe('base64encode', () => {
  it('encodes a string', () => {
    expect(base64encode('hello world')).toBe('aGVsbG8gd29ybGQ=');
  });

  it('encodes a JsonWebKey object', () => {
    const encoded = base64encode(TEST_AES_KEY);
    expect(base64decode(encoded, true)).toEqual(TEST_AES_KEY);
  });
});

describe('base64decode', () => {
  it('decodes base64 to string', () => {
    const encoded = base64encode('hello world');
    expect(base64decode(encoded, false)).toBe('hello world');
  });

  it('decodes base64 to object', () => {
    const obj = { foo: 'bar' };
    const encoded = base64encode(JSON.stringify(obj));
    expect(base64decode(encoded, true)).toEqual(obj);
  });

  it('returns original string when JSON parse fails on toObject=true', () => {
    const encoded = base64encode('not-valid-json');
    expect(base64decode(encoded, true)).toBe(encoded);
  });
});

describe('decryptVaultKeyFromSession', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns decrypted string when toJsonWebKey is false', async () => {
    mockSecretStorage.decryptString.mockResolvedValue('decryptedKey');
    const result = await decryptVaultKeyFromSession('encryptedVaultKey', false);
    expect(mockSecretStorage.decryptString).toHaveBeenCalledWith('encryptedVaultKey');
    expect(result).toBe('decryptedKey');
  });

  it('returns decrypted object when toJsonWebKey is true', async () => {
    const encoded = base64encode(JSON.stringify(TEST_AES_KEY));
    mockSecretStorage.decryptString.mockResolvedValue(encoded);
    const result = await decryptVaultKeyFromSession('encryptedVaultKey', true);
    expect(result).toEqual(TEST_AES_KEY);
  });
});
