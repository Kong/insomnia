import { createSecretKey, generateKeySync } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import ElectronStorage from '../electron-storage';
import {
  type AsyncSafeStorage,
  createLocalEncryptionKeyProvider,
  isTemporarilyUnavailableError,
  LOCAL_ENCRYPTION_KEY_STORAGE_KEY,
} from '../local-encryption-key';

vi.mock('electron', () => ({ safeStorage: {} }));

const temporarilyUnavailable = () =>
  new Error('safeStorage.decryptStringAsync is temporarily unavailable. Please try again.');

/**
 * A stand-in for the OS-protected storage. "Encrypting" tags the text with a generation; a ciphertext from an older
 * generation decrypts with `shouldReEncrypt`, like after a rotation of the OS key. Failures can be queued.
 */
interface FakeSafeStorage {
  available: boolean | Error;
  generation: number;
  encryptErrors: Error[];
  decryptErrors: Error[];
  /** Makes the next decrypt return this text instead of the real one */
  nextDecryptResult: string | undefined;
  /** Runs at the start of every decrypt, e.g. to let "another process" touch the key file */
  onDecrypt: (() => void) | undefined;
  safeStorage: { [Method in keyof AsyncSafeStorage]: Mock<AsyncSafeStorage[Method]> };
}

const createFakeSafeStorage = () => {
  const fake: FakeSafeStorage = {
    available: true,
    generation: 1,
    encryptErrors: [],
    decryptErrors: [],
    nextDecryptResult: undefined,
    onDecrypt: undefined,
    safeStorage: {
      isAsyncEncryptionAvailable: vi.fn(async () => {
        if (fake.available instanceof Error) {
          throw fake.available;
        }
        return fake.available;
      }),
      encryptStringAsync: vi.fn(async (plainText: string) => {
        const error = fake.encryptErrors.shift();
        if (error) {
          throw error;
        }
        return Buffer.from(`g${fake.generation}:${plainText}`);
      }),
      decryptStringAsync: vi.fn(async (encrypted: Buffer) => {
        fake.onDecrypt?.();
        const error = fake.decryptErrors.shift();
        if (error) {
          throw error;
        }
        const match = /^g(\d+):([\s\S]*)$/.exec(encrypted.toString());
        if (!match) {
          throw new Error('Decryption failed');
        }
        const result = fake.nextDecryptResult ?? match[2];
        fake.nextDecryptResult = undefined;
        return { result, shouldReEncrypt: Number(match[1]) < fake.generation };
      }),
    },
  };
  return fake;
};

describe('local encryption key', () => {
  let dir: string;
  let storage: ElectronStorage;
  let fake: ReturnType<typeof createFakeSafeStorage>;
  let getKey: () => ReturnType<ReturnType<typeof createLocalEncryptionKeyProvider>>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  const keyFile = () => path.join(dir, LOCAL_ENCRYPTION_KEY_STORAGE_KEY);
  const readKeyFile = () => fs.readFileSync(keyFile(), 'utf8');
  const storedCiphertext = () => Buffer.from(JSON.parse(readKeyFile()).ciphertext, 'base64').toString();
  const setStoredPlaintext = (plaintext: string) =>
    fs.writeFileSync(
      keyFile(),
      JSON.stringify({ version: 1, ciphertext: Buffer.from(`g1:${plaintext}`).toString('base64') }),
    );

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-local-key-'));
    storage = new ElectronStorage(dir);
    fake = createFakeSafeStorage();
    getKey = createLocalEncryptionKeyProvider({
      safeStorage: fake.safeStorage,
      storage,
      retry: { baseDelayMs: 1, maxDelayMs: 2, jitterRatio: 0 },
    });
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('first launch', () => {
    it('creates an AES-256 key and stores it protected, and the same key is loaded on the next launch', async () => {
      const key = await getKey();
      expect(key?.type).toBe('secret');
      expect(key?.symmetricKeySize).toBe(32);
      expect(JSON.parse(readKeyFile())).toEqual({ version: 1, ciphertext: expect.any(String) });

      const second = await getKey();
      expect(second?.equals(key!)).toBe(true);
      expect(fake.safeStorage.decryptStringAsync).toHaveBeenCalled();
    });

    it('never writes the key in plaintext', async () => {
      const key = await getKey();
      const jwk = key!.export({ format: 'jwk' });
      expect(readKeyFile()).not.toContain(jwk.k);
      expect(readKeyFile()).not.toContain('kty');
      // what is stored is exactly what safeStorage returned
      expect(storedCiphertext()).toBe(`g1:${JSON.stringify(jwk)}`);
    });

    it('saves and verifies the key before it is returned', async () => {
      const setItemDurable = vi.spyOn(storage, 'setItemDurable');
      const getItemStrict = vi.spyOn(storage, 'getItemStrict');
      const key = await getKey();
      expect(key).toBeDefined();

      const order = (spy: { mock: { invocationCallOrder: number[] } }, call = 0) => spy.mock.invocationCallOrder[call];
      expect(setItemDurable).toHaveBeenCalledTimes(1);
      expect(order(fake.safeStorage.encryptStringAsync)).toBeLessThan(order(setItemDurable));
      // getItemStrict #0 is the "does the key file exist" check, #1 the read-back
      expect(order(setItemDurable)).toBeLessThan(order(getItemStrict, 1));
      expect(order(getItemStrict, 1)).toBeLessThan(order(fake.safeStorage.decryptStringAsync));
    });

    it('does not enable encryption, and writes nothing, when the key cannot be protected', async () => {
      fake.encryptErrors = [new Error('Encryption is not available')];
      expect(await getKey()).toBeUndefined();
      expect(fs.existsSync(keyFile())).toBe(false);
      expect(fake.safeStorage.encryptStringAsync).toHaveBeenCalledTimes(1);
    });

    it('retries temporary unavailability when protecting the key, and gives up after the last attempt', async () => {
      fake.encryptErrors = [temporarilyUnavailable(), temporarilyUnavailable()];
      expect(await getKey()).toBeDefined();
      expect(fake.safeStorage.encryptStringAsync).toHaveBeenCalledTimes(3);

      fs.rmSync(keyFile());
      fake.safeStorage.encryptStringAsync.mockClear();
      fake.encryptErrors = Array.from({ length: 10 }, temporarilyUnavailable);
      expect(await getKey()).toBeUndefined();
      expect(fake.safeStorage.encryptStringAsync).toHaveBeenCalledTimes(5);
      expect(fs.existsSync(keyFile())).toBe(false);
    });

    it('creates a key on the next launch after protection failed', async () => {
      fake.encryptErrors = [new Error('Encryption is not available')];
      expect(await getKey()).toBeUndefined();
      expect(await getKey()).toBeDefined();
      expect(fs.existsSync(keyFile())).toBe(true);
    });

    it('does not enable encryption, and leaves no file, when the key cannot be saved durably', async () => {
      vi.spyOn(storage, 'setItemDurable').mockRejectedValueOnce(new Error('disk full'));
      expect(await getKey()).toBeUndefined();
      expect(fs.readdirSync(dir)).toEqual([]);
      expect(await getKey()).toBeDefined();
    });

    it('does not enable encryption when the saved key does not match, and removes it so the next launch starts over', async () => {
      // Nothing was encrypted with it yet. The read-back decrypts to some other key.
      fake.nextDecryptResult = JSON.stringify(generateKeySync('aes', { length: 256 }).export({ format: 'jwk' }));
      expect(await getKey()).toBeUndefined();
      expect(fs.existsSync(keyFile())).toBe(false);
      expect(await getKey()).toBeDefined();
    });

    it('leaves a key file alone that another process replaced while this launch verified its own', async () => {
      const replacement = JSON.stringify({ version: 1, ciphertext: Buffer.from('g1:another-key').toString('base64') });
      fake.nextDecryptResult = JSON.stringify(generateKeySync('aes', { length: 256 }).export({ format: 'jwk' }));
      fake.onDecrypt = () => {
        fake.onDecrypt = undefined;
        fs.writeFileSync(keyFile(), replacement);
      };
      expect(await getKey()).toBeUndefined();
      expect(readKeyFile()).toBe(replacement);
    });

    it('leaves the key file alone when it can no longer be read back to check whose it is', async () => {
      fake.nextDecryptResult = JSON.stringify(generateKeySync('aes', { length: 256 }).export({ format: 'jwk' }));
      fake.onDecrypt = () => {
        fake.onDecrypt = undefined;
        fs.writeFileSync(keyFile(), '{bad json');
      };
      expect(await getKey()).toBeUndefined();
      expect(readKeyFile()).toBe('{bad json');
    });

    it('does not enable encryption when the saved key cannot be read back', async () => {
      fake.decryptErrors = [new Error('Decryption failed')];
      expect(await getKey()).toBeUndefined();
      expect(fs.existsSync(keyFile())).toBe(false);
    });
  });

  describe('an existing key file', () => {
    it('loads the key, retrying temporary unavailability', async () => {
      const key = await getKey();
      fake.safeStorage.decryptStringAsync.mockClear();
      fake.decryptErrors = [temporarilyUnavailable(), temporarilyUnavailable()];
      expect((await getKey())?.equals(key!)).toBe(true);
      expect(fake.safeStorage.decryptStringAsync).toHaveBeenCalledTimes(3);
    });

    it('opens in degraded mode when retries are exhausted, leaving the key file untouched and not creating a key', async () => {
      await getKey();
      const before = readKeyFile();
      fake.safeStorage.encryptStringAsync.mockClear();
      fake.safeStorage.decryptStringAsync.mockClear();
      fake.decryptErrors = Array.from({ length: 10 }, temporarilyUnavailable);

      expect(await getKey()).toBeUndefined();
      expect(fake.safeStorage.decryptStringAsync).toHaveBeenCalledTimes(5);
      expect(fake.safeStorage.encryptStringAsync).not.toHaveBeenCalled();
      expect(readKeyFile()).toBe(before);
    });

    it('retries the next launch', async () => {
      const key = await getKey();
      fake.decryptErrors = Array.from({ length: 10 }, temporarilyUnavailable);
      expect(await getKey()).toBeUndefined();
      fake.decryptErrors = [];
      expect((await getKey())?.equals(key!)).toBe(true);
    });

    it('does not retry other errors, and leaves the key file untouched', async () => {
      await getKey();
      const before = readKeyFile();
      fake.safeStorage.decryptStringAsync.mockClear();
      fake.decryptErrors = [new Error('Decryption failed')];

      expect(await getKey()).toBeUndefined();
      expect(fake.safeStorage.decryptStringAsync).toHaveBeenCalledTimes(1);
      expect(readKeyFile()).toBe(before);
    });

    it.each([
      ['not JSON', '{bad JSON'],
      ['null', 'null'],
      ['an unknown version', JSON.stringify({ version: 2, ciphertext: 'abc' })],
      ['a missing ciphertext', JSON.stringify({ version: 1 })],
      ['a string', '"abc"'],
    ])('does not touch, replace or regenerate a key file that is %s', async (_name, contents) => {
      fs.writeFileSync(keyFile(), contents);
      fake.safeStorage.encryptStringAsync.mockClear();

      expect(await getKey()).toBeUndefined();
      expect(fs.readFileSync(keyFile(), 'utf8')).toBe(contents);
      expect(fake.safeStorage.encryptStringAsync).not.toHaveBeenCalled();
    });

    it('does not regenerate over a key file that cannot be read', async () => {
      fs.mkdirSync(keyFile());
      expect(await getKey()).toBeUndefined();
      expect(fs.statSync(keyFile()).isDirectory()).toBe(true);
      expect(fake.safeStorage.encryptStringAsync).not.toHaveBeenCalled();
    });

    it.each([
      ['not JSON', 'not a key'],
      ['not a symmetric key', JSON.stringify({ kty: 'RSA', n: 'x' })],
      ['too short', JSON.stringify(createSecretKey(Buffer.alloc(16, 1)).export({ format: 'jwk' }))],
      ['too long', JSON.stringify(createSecretKey(Buffer.alloc(64, 1)).export({ format: 'jwk' }))],
    ])('opens in degraded mode when the decrypted key is %s, leaving the file untouched', async (_name, plaintext) => {
      setStoredPlaintext(plaintext);
      const before = readKeyFile();
      expect(await getKey()).toBeUndefined();
      expect(readKeyFile()).toBe(before);
      expect(fake.safeStorage.encryptStringAsync).not.toHaveBeenCalled();
    });
  });

  describe('rotation of the OS key (shouldReEncrypt)', () => {
    it('encrypts the same key again and writes it back durably, and the key does not change', async () => {
      const key = await getKey();
      expect(storedCiphertext().startsWith('g1:')).toBe(true);

      fake.generation = 2;
      const setItemDurable = vi.spyOn(storage, 'setItemDurable');
      expect((await getKey())?.equals(key!)).toBe(true);
      expect(setItemDurable).toHaveBeenCalledTimes(1);
      expect(storedCiphertext().startsWith('g2:')).toBe(true);

      // rotated once, not again
      fake.safeStorage.decryptStringAsync.mockClear();
      setItemDurable.mockClear();
      expect((await getKey())?.equals(key!)).toBe(true);
      expect(fake.safeStorage.decryptStringAsync).toHaveBeenCalledTimes(1);
      expect(setItemDurable).not.toHaveBeenCalled();
    });

    it('still returns the key when the second decrypt fails, and leaves the stored key as it is', async () => {
      const key = await getKey();
      const before = readKeyFile();
      fake.generation = 2;
      fake.safeStorage.decryptStringAsync.mockClear();
      fake.safeStorage.encryptStringAsync.mockClear();
      // the first decrypt succeeds (and asks for a re-encrypt), the second one fails with an error that is not retried
      fake.onDecrypt = () => {
        if (fake.safeStorage.decryptStringAsync.mock.calls.length === 2) {
          fake.decryptErrors = [new Error('Keychain error')];
        }
      };

      expect((await getKey())?.equals(key!)).toBe(true);
      expect(fake.safeStorage.decryptStringAsync).toHaveBeenCalledTimes(2);
      expect(fake.safeStorage.encryptStringAsync).not.toHaveBeenCalled();
      expect(readKeyFile()).toBe(before);
    });

    it('still returns the key when the write-back fails, and keeps the old ciphertext', async () => {
      const key = await getKey();
      const before = readKeyFile();
      fake.generation = 2;
      vi.spyOn(storage, 'setItemDurable').mockRejectedValueOnce(new Error('disk full'));

      expect((await getKey())?.equals(key!)).toBe(true);
      expect(readKeyFile()).toBe(before);
      expect(consoleError).toHaveBeenCalled();
    });
  });

  describe('safeStorage availability', () => {
    it.each([false, new Error('boom')])('is only a signal: still tries when it reports %s', async available => {
      fake.available = available;
      const key = await getKey();
      expect(key).toBeDefined();
      expect(fake.safeStorage.isAsyncEncryptionAvailable).toHaveBeenCalled();
    });
  });

  it('only uses the strict storage methods, never setItem / getItem', async () => {
    const setItem = vi.spyOn(storage, 'setItem');
    const getItem = vi.spyOn(storage, 'getItem');
    await getKey(); // create
    fake.generation = 2;
    await getKey(); // rotate
    fake.decryptErrors = [new Error('Decryption failed')];
    await getKey(); // degraded
    fs.writeFileSync(keyFile(), '{bad JSON');
    await getKey(); // corrupt
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });

  it('stores the key in the file localStorage/fieldEncryptionKey of the data directory', () => {
    expect(LOCAL_ENCRYPTION_KEY_STORAGE_KEY).toBe('fieldEncryptionKey');
  });
});

describe('isTemporarilyUnavailableError()', () => {
  it('recognises the safeStorage error by its message', () => {
    expect(isTemporarilyUnavailableError(temporarilyUnavailable())).toBe(true);
    expect(isTemporarilyUnavailableError('safeStorage is Temporarily Unavailable')).toBe(true);
    expect(isTemporarilyUnavailableError(new Error('Decryption failed'))).toBe(false);
    expect(isTemporarilyUnavailableError(null)).toBe(false);
  });
});
