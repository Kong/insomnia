import { getElectronStorage } from '../electron-storage';
import { LOCAL_ENCRYPTION_KEY_STORAGE_KEY } from '../local-encryption-key';

/**
 * Keys of the main process's `ElectronStorage` that the renderer must never read, write or delete through the generic
 * storage IPC handlers. The local encryption key is the only one: a renderer that could delete or overwrite its file would
 * make the next launch create a new key, which orphans every encrypted field on disk, or plant a key of its own choosing.
 * Every key that starts with a reserved name is reserved too, which covers the copies that are set aside when the user
 * starts over with a new key (`<name>.bak-<time>`).
 */
const RESERVED_STORAGE_KEYS = [LOCAL_ENCRYPTION_KEY_STORAGE_KEY];

// The names a file system treats as the same file as `reservedKey` without it being the same string: the case on a
// case-insensitive file system (with Unicode case folding), trailing dots and spaces on Windows, and a Windows alternate
// data stream (`name:stream`, `name::$DATA`).
const normalizeKey = (key: string) =>
  key
    .split(':')[0]
    .replace(/[. ]+$/, '')
    .normalize('NFKC')
    .toLowerCase();

const isReservedStorageKey = (key: string) => {
  const normalized = normalizeKey(key);
  const storage = getElectronStorage();
  return RESERVED_STORAGE_KEYS.some(
    reservedKey =>
      normalized.startsWith(normalizeKey(reservedKey)) ||
      // Any other way to reach the same file (a Windows short name, a hard link)
      storage.isSameFile(key, reservedKey),
  );
};

/** Throws when the renderer asks for a key that only the main process may use. Call it first in every renderer-facing storage handler. */
export const assertStorageKeyAllowedForRenderer = (key: string) => {
  if (isReservedStorageKey(key)) {
    throw new Error('Access to this storage key is not allowed');
  }
};
