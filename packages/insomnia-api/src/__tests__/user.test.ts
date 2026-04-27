import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getEncryptionKeys, getUserProfile } from '../user';

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.mock('../fetch', () => ({
  fetch: mockFetch,
}));

describe('getUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns first_name and last_name from the API response', async () => {
    mockFetch.mockResolvedValue({
      id: 'usr_abc123',
      email: 'jane@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      picture: 'https://example.com/pic.jpg',
    });

    const result = await getUserProfile({ sessionId: 'sess_xyz' });

    expect(result.first_name).toBe('Jane');
    expect(result.last_name).toBe('Doe');
  });

  it('passes id through as-is', async () => {
    mockFetch.mockResolvedValue({
      id: 'usr_abc123',
      email: 'jane@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      picture: '',
    });

    const result = await getUserProfile({ sessionId: 'sess_xyz' });

    expect(result.id).toBe('usr_abc123');
  });

  it('passes picture through as-is', async () => {
    mockFetch.mockResolvedValue({
      id: 'usr_abc123',
      email: 'jane@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      picture: 'https://example.com/pic.jpg',
    });

    const result = await getUserProfile({ sessionId: 'sess_xyz' });

    expect(result.picture).toBe('https://example.com/pic.jpg');
  });

  it('calls fetch with the correct path and sessionId', async () => {
    mockFetch.mockResolvedValue({
      id: 'usr_abc123',
      email: 'jane@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      picture: '',
    });

    await getUserProfile({ sessionId: 'sess_xyz' });

    expect(mockFetch).toHaveBeenCalledWith({ method: 'GET', path: '/v3/users/me', sessionId: 'sess_xyz' });
  });
});

describe('getEncryptionKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes encryption key fields through as-is', async () => {
    mockFetch.mockResolvedValue({
      public_key: '{"kty":"RSA"}',
      enc_private_key: '{"iv":"abc"}',
      enc_symmetric_key: '{"iv":"def"}',
      salt_enc: 'deadbeef',
      enc_driver_key: null,
    });

    const result = await getEncryptionKeys({ sessionId: 'sess_xyz' });

    expect(result.public_key).toBe('{"kty":"RSA"}');
    expect(result.enc_private_key).toBe('{"iv":"abc"}');
    expect(result.enc_symmetric_key).toBe('{"iv":"def"}');
    expect(result.salt_enc).toBe('deadbeef');
  });

  it('calls fetch with the correct path and sessionId', async () => {
    mockFetch.mockResolvedValue({
      public_key: '',
      enc_private_key: '',
      enc_symmetric_key: '',
      salt_enc: '',
      enc_driver_key: '',
    });

    await getEncryptionKeys({ sessionId: 'sess_xyz' });

    expect(mockFetch).toHaveBeenCalledWith({
      method: 'GET',
      path: '/v3/users/me/encryption-keys',
      sessionId: 'sess_xyz',
    });
  });
});
