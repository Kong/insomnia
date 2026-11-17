import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { invariant } from '~/common/utils/invariant';

// On Windows, a virus scanner or indexer that briefly holds a file open makes the rename over it fail with one of these
const TRANSIENT_RENAME_ERROR_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);
const MAX_RENAME_ATTEMPTS = 5;
const RENAME_RETRY_BASE_DELAY_MS = 20;

// Intentional singleton: initialized once per process via initElectronStorage and shared across the app.
let electronStorage: ElectronStorage | null = null;
export function initElectronStorage(dataPath: string) {
  const electronStoragePath = path.join(dataPath, 'localStorage');
  const resolvedDataPath = path.resolve(dataPath);
  const resolvedElectronStoragePath = path.resolve(electronStoragePath);
  const relativePath = path.relative(resolvedDataPath, resolvedElectronStoragePath);
  invariant(!relativePath.startsWith('..') && !path.isAbsolute(relativePath), `Invalid path`);
  // Ensure that electronStorage is not yet initialized before creating a new instance. This prevents accidental re-initialization with a different path, which could lead to data loss.
  invariant(
    !electronStorage,
    `ElectronStorage already initialized. Attempted re-init with: ${resolvedElectronStoragePath}`,
  );
  electronStorage = new ElectronStorage(resolvedElectronStoragePath);
}
export function getElectronStorage(): ElectronStorage {
  invariant(electronStorage, 'ElectronStorage has not been initialized.');
  return electronStorage;
}

class ElectronStorage {
  _buffer: Record<string, string> = {};
  _timeouts: Record<string, NodeJS.Timeout> = {};
  _basePath: string | null = null;

  constructor(basePath: string) {
    this._basePath = basePath;
    // Debounce writes on a per key basis
    fs.mkdirSync(basePath, { recursive: true });

    console.log(`[ElectronStorage] Initialized at ${basePath}`);
  }

  setItem<T>(key: string, obj?: T) {
    const storageKey = this._validateKey(key);
    clearTimeout(this._timeouts[storageKey]);
    this._buffer[storageKey] = JSON.stringify(obj);
    this._timeouts[storageKey] = setTimeout(this._flush.bind(this), 100);
  }

  getItem<T>(key: string, defaultObj?: T) {
    const storageKey = this._validateKey(key);
    // Make sure things are flushed before we read
    this._flush();

    let contents = JSON.stringify(defaultObj);

    const path = this._getKeyPath(storageKey);

    try {
      contents = String(fs.readFileSync(path));
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.setItem(storageKey, defaultObj);
      }
    }

    try {
      return JSON.parse(contents);
    } catch (error) {
      console.error(`[ElectronStorage] Failed to parse item from electron storage: ${error}`);
      return defaultObj;
    }
  }

  /**
   * Writes a value so that it survives a crash, for values that must never be lost or truncated (the local field
   * encryption key). Unlike `setItem`, which buffers the write and writes it 100 ms later straight over the target, this
   * writes a temporary file next to it, fsyncs it, renames it over the target and then fsyncs the directory. The target is
   * therefore always either the old or the new content. Rejects on any failure, and a failure never leaves a temporary file
   * behind. The value is stored as JSON, so `getItem` and `getItemStrict` can read it.
   */
  async setItemDurable<T>(key: string, obj: T): Promise<void> {
    const storageKey = this._validateKey(key);
    // A buffered `setItem` of the same key must not land after this write
    clearTimeout(this._timeouts[storageKey]);
    delete this._buffer[storageKey];

    const targetPath = this._getKeyPath(storageKey);
    const tempPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      const file = await fs.promises.open(tempPath, 'w', 0o600);
      try {
        await file.writeFile(JSON.stringify(obj), 'utf8');
        await file.sync();
      } finally {
        await file.close();
      }
      await this._renameWithRetry(tempPath, targetPath);
    } catch (error) {
      await fs.promises.rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }
    await this._syncDirectory(path.dirname(targetPath));
  }

  /**
   * Reads a value without ever treating a problem as "not there". Returns `null` only when the file does not exist. Throws
   * when the file exists but cannot be read or parsed. Never writes, unlike `getItem`, which falls back to a default
   * value for an unreadable file and creates a missing one.
   */
  getItemStrict<T>(key: string): T | null {
    const storageKey = this._validateKey(key);
    let contents: string;
    try {
      contents = fs.readFileSync(this._getKeyPath(storageKey), 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
    const value = JSON.parse(contents);
    if (value === null) {
      throw new Error(`Electron storage item "${storageKey}" exists but holds null`);
    }
    return value;
  }

  /**
   * Whether two keys are the same file on disk. A path can reach a file under another name (a different case on a
   * case-insensitive filesystem, a Windows short name, a hard link), so keys cannot be compared by name alone. False when
   * either file does not exist, or when the filesystem does not tell files apart (some report inode 0 for every file).
   * Throws when a file cannot be inspected for any other reason, rather than answering "no" without having checked.
   */
  isSameFile(key: string, otherKey: string) {
    const stat = (storageKey: string) => {
      try {
        return fs.statSync(this._getKeyPath(this._validateKey(storageKey)), { bigint: true });
      } catch (error) {
        if (error.code === 'ENOENT') {
          return null;
        }
        throw error;
      }
    };
    const file = stat(key);
    const other = stat(otherKey);
    if (!file || !other || file.ino === 0n || other.ino === 0n) {
      return false;
    }
    return file.dev === other.dev && file.ino === other.ino;
  }

  deleteItem(key: string) {
    const storageKey = this._validateKey(key);
    clearTimeout(this._timeouts[storageKey]);
    delete this._buffer[storageKey];

    const path = this._getKeyPath(storageKey);

    try {
      fs.unlinkSync(path);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`[localstorage] Failed to delete item from LocalStorage: ${error}`);
      }
    }
  }

  _validateKey(key: string) {
    if (!key || key === '.' || key === '..' || key.includes('/') || key.includes('\\') || key.includes('\0')) {
      throw new Error('Invalid electron storage key');
    }

    return key;
  }

  _flush() {
    const keys = Object.keys(this._buffer);

    if (!keys.length) {
      return;
    }

    for (const key of keys) {
      const contents = this._buffer[key];

      const path = this._getKeyPath(key);

      delete this._buffer[key];

      try {
        fs.writeFileSync(path, contents);
      } catch (error) {
        console.error(`[ElectronStorage] Failed to save to electron storage: ${error}`);
      }
    }
  }

  /** Renames, retrying the errors that are transient on Windows (see TRANSIENT_RENAME_ERROR_CODES) a few times. */
  async _renameWithRetry(from: string, to: string) {
    for (let attempt = 1; ; attempt++) {
      try {
        await fs.promises.rename(from, to);
        return;
      } catch (error) {
        const retriable = process.platform === 'win32' && TRANSIENT_RENAME_ERROR_CODES.has(error.code);
        if (!retriable || attempt >= MAX_RENAME_ATTEMPTS) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, RENAME_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)));
      }
    }
  }

  async _syncDirectory(directory: string) {
    // Makes the rename itself durable. Windows cannot open a directory to fsync it.
    if (process.platform === 'win32') {
      return;
    }
    const handle = await fs.promises.open(directory, 'r');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  _getKeyPath(key: string) {
    // @ts-expect-error -- TSCONVERSION this appears to be a genuine error
    return path.join(this._basePath, key);
  }
}

export default ElectronStorage;
