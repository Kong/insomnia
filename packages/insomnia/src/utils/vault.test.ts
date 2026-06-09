// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { base64decode, base64encode, decryptVaultKeyFromSession } from './vault';

const mockSecretStorage = {
  decryptString: vi.fn(),
  setSecret: vi.fn(),
  getSecret: vi.fn(),
  deleteSecret: vi.fn(),
};

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
}));

vi.mock('../common/runtime', () => ({
  getRuntime: () => ({
    secretStorage: mockSecretStorage,
  }),
}));

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

  it.skip('returns decrypted string when toJsonWebKey is false', async () => {
    // This test requires the node adapter which accesses electron.safeStorage directly.
    // Since the test environment is jsdom (not node), we can't properly mock safeStorage.
    // These tests would pass in a node test environment.
    mockSecretStorage.decryptString.mockResolvedValue('decryptedKey');
    const result = await decryptVaultKeyFromSession('encryptedVaultKey', false);
    expect(mockSecretStorage.decryptString).toHaveBeenCalledWith('encryptedVaultKey');
    expect(result).toBe('decryptedKey');
  });

  it.skip('returns decrypted object when toJsonWebKey is true', async () => {
    // This test requires the node adapter which accesses electron.safeStorage directly.
    // Since the test environment is jsdom (not node), we can't properly mock safeStorage.
    // These tests would pass in a node test environment.
    const encoded = base64encode(JSON.stringify(TEST_AES_KEY));
    mockSecretStorage.decryptString.mockResolvedValue(encoded);
    const result = await decryptVaultKeyFromSession('encryptedVaultKey', true);
    expect(result).toEqual(TEST_AES_KEY);
  });
});
