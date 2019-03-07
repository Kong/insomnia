// @flow

import type { BaseDriver } from './base';

export default class MemoryDriver implements BaseDriver {
  _db: { [string]: Buffer };

  constructor() {
    this._init();
  }

  hasItem(key: string): Promise<boolean> {
    return Promise.resolve(typeof this._db[key] === 'string');
  }

  setItem(key: string, value: Buffer): Promise<void> {
    this._db[String(key)] = value;
    return Promise.resolve();
  }

  getItem(key: string): Promise<Buffer | null> {
    let value = null;

    if (this.hasItem(key)) {
      value = this._db[String(key)];
    }

    return Promise.resolve(value);
  }

  removeItem(key: string): Promise<void> {
    delete this._db[String(key)];
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this._init();
    return Promise.resolve();
  }

  keys(prefix: string): Promise<Array<string>> {
    const keys = [];

    for (const key of Object.keys(this._db)) {
      if (key.indexOf(prefix) === 0) {
        keys.push(key);
      }
    }

    return Promise.resolve(keys);
  }

  _init() {
    this._db = {};
  }
}
