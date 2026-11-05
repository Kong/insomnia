import { createSecretKey, generateKeySync, type KeyObject } from 'node:crypto';

import { safeStorage } from 'electron';

import { getElectronStorage } from './electron-storage';

/**
 * The local key that encrypts the sensitive fields of the local database, and its lifecycle.
 *
 * The key is a random AES-256 key, generated on the first launch. At rest it is a JWK, encrypted with the asynchronous
 * `safeStorage` API (`encryptStringAsync` / `decryptStringAsync`, so protected by the OS: DPAPI, Keychain, Secret Service)
 * and stored through `ElectronStorage`. This code never writes it unencrypted. How strongly safeStorage protects it
 * depends on the platform's backend (on Linux, `basic_text` has no OS keyring behind it); how to treat that is an open
 * question.
 *
 * Rules this file enforces:
 * - Only the strict storage methods are used, never `setItem` / `getItem`. `setItem` defers the write and does not make it
 *   durable, swallows write errors, and `getItem` turns an unreadable file into a default value, which would read as "there
 *   is no key" and lead to a new one being generated over the old one.
 * - A new key is generated only when the key file does not exist. Anything else that goes wrong with an existing key file
 *   (unreadable, corrupt, cannot be decrypted, temporarily unavailable) leaves the file untouched and the database runs
 *   without encryption for this session ("degraded mode"). The next launch tries again. Generating a new key over an
 *   unreadable one would orphan every encrypted field on disk.
 * - A new key is saved and read back before it is returned, so no datastore is ever written with encryption before the key
 *   is safely on disk. A crash after the `.db` files are encrypted, but before the key is on disk, would make the data
 *   unreadable for good.
 * - Needs `app` to be ready: `isAsyncEncryptionAvailable()` resolves false before that.
 */

/** The `ElectronStorage` key (so the file `<dataPath>/localStorage/fieldEncryptionKey`). */
export const LOCAL_ENCRYPTION_KEY_STORAGE_KEY = 'fieldEncryptionKey';

const KEY_LENGTH_BYTES = 32;

/** What is stored: the JWK, encrypted with safeStorage, as base64. The version allows another format later. */
interface StoredKey {
  version: 1;
  ciphertext: string;
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 5,
  baseDelayMs: 120,
  maxDelayMs: 2000,
  jitterRatio: 0.2,
};

/** The part of Electron's `safeStorage` that is used. */
export interface AsyncSafeStorage {
  isAsyncEncryptionAvailable: () => Promise<boolean>;
  encryptStringAsync: (plainText: string) => Promise<Buffer>;
  decryptStringAsync: (encrypted: Buffer) => Promise<{ result: string; shouldReEncrypt: boolean }>;
}

/** The part of `ElectronStorage` that is used. */
export interface KeyStorage {
  getItemStrict: <T>(key: string) => T | null;
  setItemDurable: <T>(key: string, value: T) => Promise<void>;
  deleteItem: (key: string) => void;
}

export const isTemporarilyUnavailableError = (error: unknown) =>
  String((error as Error | undefined)?.message ?? error)
    .toLowerCase()
    .includes('temporarily unavailable');

const computeBackoffDelayMs = (attempt: number, options: RetryOptions) => {
  const exponential = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** (attempt - 1));
  const jitterWindow = Math.floor(exponential * options.jitterRatio);
  return exponential + (jitterWindow > 0 ? Math.floor(Math.random() * (jitterWindow + 1)) : 0);
};

/** Retries `operation` with bounded exponential backoff, but only for errors that `shouldRetry` accepts. */
const withExponentialBackoff = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions,
  shouldRetry: (error: unknown) => boolean,
): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!shouldRetry(error) || attempt >= options.maxAttempts) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, computeBackoffDelayMs(attempt, options)));
    }
  }
};

const isStoredKey = (value: unknown): value is StoredKey =>
  typeof value === 'object' &&
  value !== null &&
  (value as StoredKey).version === 1 &&
  typeof (value as StoredKey).ciphertext === 'string';

const importKey = (jwkJson: string): KeyObject => {
  const jwk = JSON.parse(jwkJson);
  if (jwk?.kty !== 'oct' || typeof jwk.k !== 'string') {
    throw new Error('The stored key is not a symmetric JWK');
  }
  const key = createSecretKey(Buffer.from(jwk.k, 'base64url'));
  if (key.symmetricKeySize !== KEY_LENGTH_BYTES) {
    throw new Error('The stored key is not a 256-bit key');
  }
  return key;
};

export const createLocalEncryptionKeyProvider = ({
  safeStorage: osStorage,
  storage,
  retry,
}: {
  safeStorage: AsyncSafeStorage;
  storage: KeyStorage;
  retry?: Partial<RetryOptions>;
}) => {
  const retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...retry };
  const retryTemporaryUnavailability = <T>(operation: () => Promise<T>) =>
    withExponentialBackoff(operation, retryOptions, isTemporarilyUnavailableError);

  const toStoredKey = (ciphertext: Buffer): StoredKey => ({ version: 1, ciphertext: ciphertext.toString('base64') });
  const writeKey = (ciphertext: Buffer) =>
    storage.setItemDurable(LOCAL_ENCRYPTION_KEY_STORAGE_KEY, toStoredKey(ciphertext));

  /**
   * Decrypts the stored key. When the OS signals that its own key or provider rotated (`shouldReEncrypt`), the key is
   * encrypted again and written back, so the stored copy follows the rotation. The AES key itself never changes, so the
   * ciphertext of the `.db` files is not affected, and a failed write-back is not an error: it is tried again next launch.
   */
  const decryptKey = (stored: StoredKey) => {
    const ciphertext = Buffer.from(stored.ciphertext, 'base64');
    return retryTemporaryUnavailability(async () => {
      const first = await osStorage.decryptStringAsync(ciphertext);
      if (typeof first?.result !== 'string') {
        throw new TypeError('decryptStringAsync returned an invalid result');
      }
      if (first.shouldReEncrypt) {
        // The key is already in hand: whatever goes wrong while rotating the stored copy must not fail the load
        try {
          // The Electron documentation asks for a second decrypt before re-encrypting
          const second = await osStorage.decryptStringAsync(ciphertext);
          const plaintext = typeof second?.result === 'string' ? second.result : first.result;
          await writeKey(await osStorage.encryptStringAsync(plaintext));
        } catch (error) {
          console.error('[local-encryption-key] Could not write back the re-encrypted key:', error);
        }
      }
      return importKey(first.result);
    });
  };

  const readStoredKey = (): StoredKey | null => {
    const stored = storage.getItemStrict<unknown>(LOCAL_ENCRYPTION_KEY_STORAGE_KEY);
    if (stored !== null && !isStoredKey(stored)) {
      throw new Error('The stored key has an unknown format');
    }
    return stored;
  };

  const createKey = async (): Promise<KeyObject | undefined> => {
    const key = generateKeySync('aes', { length: KEY_LENGTH_BYTES * 8 });
    let written: StoredKey;
    try {
      const ciphertext = await retryTemporaryUnavailability(() =>
        osStorage.encryptStringAsync(JSON.stringify(key.export({ format: 'jwk' }))),
      );
      // Nothing is left behind if this fails: the write goes through a temporary file
      await writeKey(ciphertext);
      written = toStoredKey(ciphertext);
    } catch (error) {
      console.error('[local-encryption-key] Could not protect and save a new key, encryption stays off:', error);
      return undefined;
    }

    // Read it back and compare, before any datastore is written with this key
    try {
      const stored = readStoredKey();
      if (!stored || !(await decryptKey(stored)).equals(key)) {
        throw new Error('The saved key does not match the generated key');
      }
    } catch (error) {
      console.error('[local-encryption-key] Could not verify the saved key, encryption stays off:', error);
      // Nothing was encrypted with this key yet, so removing it loses nothing, and lets the next launch create a new one.
      // But only if the file is still the one this launch wrote: if another process replaced it meanwhile, that is its key,
      // and it may already be encrypting data with it.
      try {
        if (readStoredKey()?.ciphertext === written.ciphertext) {
          storage.deleteItem(LOCAL_ENCRYPTION_KEY_STORAGE_KEY);
        } else {
          console.warn('[local-encryption-key] The key file was replaced by another process, leaving it alone');
        }
      } catch (deleteError) {
        console.error('[local-encryption-key] Could not remove the unverified key:', deleteError);
      }
      return undefined;
    }
    return key;
  };

  /**
   * Loads the local encryption key, creating it on the first launch. Resolves undefined when the key cannot be loaded or
   * created, which puts the database in degraded mode (it opens without encryption).
   */
  return async (): Promise<KeyObject | undefined> => {
    try {
      if (!(await osStorage.isAsyncEncryptionAvailable())) {
        // Only a signal: every call below is still treated as fallible
        console.warn('[local-encryption-key] safeStorage reports that async encryption is not available');
      }
    } catch (error) {
      console.warn('[local-encryption-key] Could not check whether async encryption is available:', error);
    }

    let stored: StoredKey | null;
    try {
      stored = readStoredKey();
    } catch (error) {
      // The file exists but cannot be used. Never generate a key here.
      console.error('[local-encryption-key] The key file cannot be read, encryption stays off:', error);
      return undefined;
    }

    if (stored === null) {
      return createKey();
    }
    try {
      return await decryptKey(stored);
    } catch (error) {
      // The key file is left untouched, and the next launch tries again
      console.error('[local-encryption-key] The key cannot be decrypted, encryption stays off:', error);
      return undefined;
    }
  };
};

/** Loads the local encryption key, creating it on the first launch. Needs `app` to be ready. */
export const getLocalEncryptionKey = () =>
  createLocalEncryptionKeyProvider({ safeStorage, storage: getElectronStorage() })();
