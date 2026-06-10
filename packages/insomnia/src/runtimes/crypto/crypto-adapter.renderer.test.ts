// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { decryptSecretValue, encryptSecretValue } from './crypto-adapter.renderer';

const mockEncrypt = vi.fn();
const mockDecrypt = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(window, 'main', {
    value: { vault: { encryptSecretValue: mockEncrypt, decryptSecretValue: mockDecrypt } },
    writable: true,
  });
});

const VALID_KEY: JsonWebKey = {
  kty: 'oct',
  alg: 'A256GCM',
  ext: true,
  key_ops: ['encrypt', 'decrypt'],
  k: '5hs1f2xuiNPHUp11i6SWlsqYpWe_hWPcEKucZlwBfFE',
};

describe('encryptSecretValue', () => {
  it('returns rawValue when symmetricKey is not an object', async () => {
    expect(await encryptSecretValue('secret', 'invalid' as unknown as JsonWebKey)).toBe('secret');
    expect(mockEncrypt).not.toHaveBeenCalled();
  });

  it('returns rawValue when symmetricKey is empty object', async () => {
    expect(await encryptSecretValue('secret', {})).toBe('secret');
    expect(mockEncrypt).not.toHaveBeenCalled();
  });

  it('delegates to window.main.vault.encryptSecretValue with a valid key', async () => {
    mockEncrypt.mockResolvedValue('encrypted-value');
    const result = await encryptSecretValue('my secret', VALID_KEY);
    expect(mockEncrypt).toHaveBeenCalledWith('my secret', VALID_KEY);
    expect(result).toBe('encrypted-value');
  });

  it('returns rawValue when IPC call throws', async () => {
    mockEncrypt.mockRejectedValue(new Error('IPC error'));
    const result = await encryptSecretValue('my secret', VALID_KEY);
    expect(result).toBe('my secret');
  });
});

describe('decryptSecretValue', () => {
  it('returns encryptedValue when symmetricKey is not an object', async () => {
    expect(await decryptSecretValue('encrypted', 'invalid' as unknown as JsonWebKey)).toBe('encrypted');
    expect(mockDecrypt).not.toHaveBeenCalled();
  });

  it('returns encryptedValue when symmetricKey is empty object', async () => {
    expect(await decryptSecretValue('encrypted', {})).toBe('encrypted');
    expect(mockDecrypt).not.toHaveBeenCalled();
  });

  it('delegates to window.main.vault.decryptSecretValue with a valid key', async () => {
    mockDecrypt.mockResolvedValue('plaintext');
    const result = await decryptSecretValue('encrypted-blob', VALID_KEY);
    expect(mockDecrypt).toHaveBeenCalledWith('encrypted-blob', VALID_KEY);
    expect(result).toBe('plaintext');
  });

  it('returns encryptedValue when IPC call throws', async () => {
    mockDecrypt.mockRejectedValue(new Error('IPC error'));
    const result = await decryptSecretValue('encrypted-blob', VALID_KEY);
    expect(result).toBe('encrypted-blob');
  });
});
