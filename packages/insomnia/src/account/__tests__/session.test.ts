import * as insomniaApi from 'insomnia-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as crypt from '../crypt';
import {
  absorbKey,
  getCurrentSessionId,
  getPrivateKey,
  getUserSession,
  isLoggedIn,
  logout,
  setSessionData,
} from '../session';

vi.mock('insomnia-api', () => ({
  getUserProfile: vi.fn(),
  getEncryptionKeys: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../crypt', () => ({
  decryptAES: vi.fn(),
}));

interface MockWindowMain {
  loginStateChange: ReturnType<typeof vi.fn>;
}

const getWindowMain = () => (window as unknown as { main: MockWindowMain }).main;

// Fixtures
const SESSION_ID = 'test-session-id';
const RAW_KEY = 'raw-key-material';

const MOCK_PUBLIC_KEY = { kty: 'RSA', n: 'abc', e: 'AQAB' };
const MOCK_ENC_PRIVATE_KEY = { iv: 'iv1', t: 't1', d: 'd1', ad: 'ad1' };
const MOCK_ENC_SYMMETRIC_KEY = { iv: 'iv2', t: 't2', d: 'd2', ad: 'ad2' };
const MOCK_SYMMETRIC_KEY = { kty: 'oct', k: 'sym-key' };

const mockEncryptionKeys = {
  public_key: JSON.stringify(MOCK_PUBLIC_KEY),
  enc_private_key: JSON.stringify(MOCK_ENC_PRIVATE_KEY),
  enc_symmetric_key: JSON.stringify(MOCK_ENC_SYMMETRIC_KEY),
  salt_enc: 'salt',
  enc_driver_key: '',
};

const mockUserProfile = {
  id: 'account-123',
  created_at: new Date('2026-01-01T00:00:00Z'),
  email: 'test@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  picture: '',
  emails: [],
  encryption_enabled: false,
  is_externally_provisioned: false,
};

beforeEach(() => {
  vi.mocked(insomniaApi.getUserProfile).mockResolvedValue(mockUserProfile);
  vi.mocked(insomniaApi.getEncryptionKeys).mockResolvedValue(mockEncryptionKeys);
  vi.mocked(crypt.decryptAES).mockReturnValue(JSON.stringify(MOCK_SYMMETRIC_KEY));

  vi.stubGlobal('window', { main: { loginStateChange: vi.fn() } });
});

describe('absorbKey', () => {
  it('fetches profile and encryption keys with the provided sessionId', async () => {
    await absorbKey(SESSION_ID, RAW_KEY);

    expect(insomniaApi.getUserProfile).toHaveBeenCalledWith({ sessionId: SESSION_ID });
    expect(insomniaApi.getEncryptionKeys).toHaveBeenCalledWith({ sessionId: SESSION_ID });
  });

  it('decrypts the symmetric key using the provided raw key and encSymmetricKey', async () => {
    await absorbKey(SESSION_ID, RAW_KEY);

    expect(crypt.decryptAES).toHaveBeenCalledWith(RAW_KEY, MOCK_ENC_SYMMETRIC_KEY);
  });

  it('stores session data with mapped fields from profile and encryption keys', async () => {
    await absorbKey(SESSION_ID, RAW_KEY);

    const session = await getUserSession();
    expect(session.id).toBe(SESSION_ID);
    expect(session.accountId).toBe(mockUserProfile.id);
    expect(session.email).toBe(mockUserProfile.email);
    expect(session.firstName).toBe(mockUserProfile.first_name);
    expect(session.lastName).toBe(mockUserProfile.last_name);
    expect(session.symmetricKey).toEqual(MOCK_SYMMETRIC_KEY);
    expect(session.publicKey).toEqual(MOCK_PUBLIC_KEY);
    expect(session.encPrivateKey).toEqual(MOCK_ENC_PRIVATE_KEY);
  });

  it('triggers loginStateChange after storing session', async () => {
    await absorbKey(SESSION_ID, RAW_KEY);

    expect(getWindowMain().loginStateChange).toHaveBeenCalledOnce();
  });

  it('falls back to current session id when none is provided', async () => {
    // First establish a session so getCurrentSessionId returns something
    await setSessionData(
      SESSION_ID,
      'acct',
      'A',
      'B',
      'a@b.com',
      {} as JsonWebKey,
      {} as JsonWebKey,
      {} as crypt.AESMessage,
    );

    await absorbKey('', RAW_KEY);

    expect(insomniaApi.getUserProfile).toHaveBeenCalledWith({ sessionId: SESSION_ID });
    expect(insomniaApi.getEncryptionKeys).toHaveBeenCalledWith({ sessionId: SESSION_ID });
  });
});

describe('getPrivateKey', () => {
  it('decrypts and returns the private key from session, and throws when keys are missing', async () => {
    const mockPrivateKey = { kty: 'RSA', d: 'private' };
    vi.mocked(crypt.decryptAES).mockReturnValue(JSON.stringify(mockPrivateKey));

    await setSessionData(
      SESSION_ID,
      'acct',
      'A',
      'B',
      'a@b.com',
      MOCK_SYMMETRIC_KEY as JsonWebKey,
      MOCK_PUBLIC_KEY as JsonWebKey,
      MOCK_ENC_PRIVATE_KEY as crypt.AESMessage,
    );

    const privateKey = await getPrivateKey();

    expect(crypt.decryptAES).toHaveBeenCalledWith(MOCK_SYMMETRIC_KEY, MOCK_ENC_PRIVATE_KEY);
    expect(privateKey).toEqual(mockPrivateKey);

    await setSessionData(
      '',
      '',
      '',
      '',
      '',
      null as unknown as JsonWebKey,
      {} as JsonWebKey,
      null as unknown as crypt.AESMessage,
    );

    await expect(getPrivateKey()).rejects.toThrow("Can't get private key: session is missing keys.");
  });
});

describe('isLoggedIn', () => {
  it('returns true when a session id exists', async () => {
    await setSessionData(
      SESSION_ID,
      'acct',
      'A',
      'B',
      'a@b.com',
      {} as JsonWebKey,
      {} as JsonWebKey,
      {} as crypt.AESMessage,
    );
    expect(await isLoggedIn()).toBe(true);
  });
});

describe('logout', () => {
  it('calls the logout API with the current session id', async () => {
    await setSessionData(
      SESSION_ID,
      'acct',
      'A',
      'B',
      'a@b.com',
      {} as JsonWebKey,
      {} as JsonWebKey,
      {} as crypt.AESMessage,
    );

    await logout();

    expect(insomniaApi.logout).toHaveBeenCalledWith({ sessionId: SESSION_ID });
  });

  it('triggers loginStateChange', async () => {
    await setSessionData(
      SESSION_ID,
      'acct',
      'A',
      'B',
      'a@b.com',
      {} as JsonWebKey,
      {} as JsonWebKey,
      {} as crypt.AESMessage,
    );

    await logout();

    expect(getWindowMain().loginStateChange).toHaveBeenCalledOnce();
  });

  it('does not throw if the API call fails', async () => {
    vi.mocked(insomniaApi.logout).mockRejectedValue(new Error('network error'));
    await setSessionData(
      SESSION_ID,
      'acct',
      'A',
      'B',
      'a@b.com',
      {} as JsonWebKey,
      {} as JsonWebKey,
      {} as crypt.AESMessage,
    );

    await expect(logout()).resolves.not.toThrow();
  });
});

describe('getCurrentSessionId', () => {
  it('returns the current session id', async () => {
    await setSessionData(
      SESSION_ID,
      'acct',
      'A',
      'B',
      'a@b.com',
      {} as JsonWebKey,
      {} as JsonWebKey,
      {} as crypt.AESMessage,
    );
    expect(await getCurrentSessionId()).toBe(SESSION_ID);
  });
});
