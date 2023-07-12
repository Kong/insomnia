import fs from 'fs';
import path from 'path';

class LocalStorage {
  _buffer: Record<string, string> = {};
  _timeouts: Record<string, NodeJS.Timeout> = {};
  _basePath: string | null = null;

  constructor(basePath: string) {
    this._basePath = basePath;
    // Debounce writes on a per key basis
    fs.mkdirSync(basePath, { recursive: true });

    console.log(`[localstorage] Initialized at ${basePath}`);
  }

  setItem<T>(key: string, obj?: T) {
    clearTimeout(this._timeouts[key]);
    this._buffer[key] = JSON.stringify(obj);
    this._timeouts[key] = setTimeout(this._flush.bind(this), 100);
  }

  getItem<T>(key: string, defaultObj?: T) {
    // Make sure things are flushed before we read
    this._flush();

    let contents = JSON.stringify(defaultObj);

    const path = this._getKeyPath(key);

    try {
      contents = String(fs.readFileSync(path));
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.setItem(key, defaultObj);
      }
    }

    try {
      return JSON.parse(contents);
    } catch (error) {
      console.error(`[localstorage] Failed to parse item from LocalStorage: ${error}`);
      return defaultObj;
    }
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
        console.error(`[localstorage] Failed to save to LocalStorage: ${error}`);
      }
    }
  }

  _getKeyPath(key: string) {
    // @ts-expect-error -- TSCONVERSION this appears to be a genuine error
    return path.join(this._basePath, key);
  }
}

export default LocalStorage;
