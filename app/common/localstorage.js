import mkdirp from 'mkdirp';
import fs from 'fs';
import path from 'path';

class LocalStorage {
  constructor (basePath) {
    this._basePath = basePath;

    // Debounce writes on a per key basis
    this._timeouts = {};

    mkdirp.sync(basePath);
    console.log(`[localstorage] Initialized at ${basePath}`);
  }

  setItem (key, obj) {
    clearTimeout(this._timeouts[key]);
    this._timeouts[key] = setTimeout(() => {
      const path = this._getKeyPath(key);
      const contents = JSON.stringify(obj);

      try {
        fs.writeFileSync(path, contents);
      } catch (e) {
        console.error(`[localstorage] Failed to save to LocalStorage: ${e}`)
      }
    }, 100);
  }

  getItem (key, defaultObj) {
    let contents = JSON.stringify(defaultObj);

    const path = this._getKeyPath(key);
    try {
      contents = fs.readFileSync(path);
    } catch (e) {
      if (e.code === 'ENOENT') {
        this.setItem(key, defaultObj);
      }
    }

    try {
      return JSON.parse(contents)
    } catch (e) {
      console.error(`[localstorage] Failed to get from LocalStorage: ${e}`)
    }
  }

  _getKeyPath (key) {
    return path.join(this._basePath, key)
  }
}

export default LocalStorage;
