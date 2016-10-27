const fs = require('fs');
const path = require('path');

class LocalStorage {
  constructor (path) {
    this._path = path;
    this._timeouts = {};
  }

  /**
   * Set an item in localStorage. Will debounce on a per-key basis
   *
   * @param key
   * @param value
   */
  setItem (key, value) {
    clearTimeout(this._timeouts[key]);
    this._timeouts[key] = setTimeout(() => {
      fs.writeFileSync(path.join(this._path, key), value);
    }, 100);
  }

  getItem (key) {
    try {
      return fs.readFileSync(path.join(this._path, key));
    } catch (e) {
      return null;
    }
  }
}

module.exports.LocalStorage = LocalStorage;
