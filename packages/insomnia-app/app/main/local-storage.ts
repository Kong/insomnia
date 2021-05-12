import mkdirp from 'mkdirp';
import fs from 'fs';
import path from 'path';

class LocalStorage {
  _buffer: Record<string, string> = {};
  _timeouts: Record<string, NodeJS.Timeout> = {};
  _basePath: string | null = null;

  constructor(basePath: string) {
    this._basePath = basePath;
    // Debounce writes on a per key basis
    mkdirp.sync(basePath);
    console.log(`[localstorage] Initialized at ${basePath}`);
  }

  setItem(key, obj) {
    clearTimeout(this._timeouts[key]);
    this._buffer[key] = JSON.stringify(obj);
    this._timeouts[key] = setTimeout(this._flush.bind(this), 100);
  }

  getItem(key, defaultObj) {
    // Make sure things are flushed before we read
    this._flush();

    let contents = JSON.stringify(defaultObj);

    const path = this._getKeyPath(key);

    try {
      contents = String(fs.readFileSync(path));
    } catch (e) {
      if (e.code === 'ENOENT') {
        this.setItem(key, defaultObj);
      }
    }

    try {
      return JSON.parse(contents);
    } catch (e) {
      console.error(`[localstorage] Failed to parse item from LocalStorage: ${e}`);
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
      } catch (e) {
        console.error(`[localstorage] Failed to save to LocalStorage: ${e}`);
      }
    }
  }

  _getKeyPath(key) {
    // @ts-expect-error -- TSCONVERSION this appears to be a genuine error
    return path.join(this._basePath, key);
  }
}

export default LocalStorage;
