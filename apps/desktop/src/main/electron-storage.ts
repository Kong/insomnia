import fs from 'node:fs';
import path from 'node:path';

import { invariant } from '~/common/utils/invariant';

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

  _getKeyPath(key: string) {
    // @ts-expect-error -- TSCONVERSION this appears to be a genuine error
    return path.join(this._basePath, key);
  }
}

export default ElectronStorage;
