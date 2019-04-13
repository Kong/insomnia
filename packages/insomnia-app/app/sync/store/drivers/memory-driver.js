// @flow

import type { BaseDriver } from './base';

export default class MemoryDriver implements BaseDriver {
  _db: { [string]: Buffer };

  constructor() {
    this._init();
  }

  async hasItem(key: string): Promise<boolean> {
    return this._db[String(key)] instanceof Buffer;
  }

  async setItem(key: string, value: Buffer): Promise<void> {
    this._db[String(key)] = value;
  }

  async getItem(key: string): Promise<Buffer | null> {
    let value = null;

    if (await this.hasItem(key)) {
      value = this._db[key];
    }

    return value;
  }

  async removeItem(key: string): Promise<void> {
    delete this._db[String(key)];
  }

  async clear(): Promise<void> {
    this._init();
  }

  async keys(prefix: string, recursive: boolean): Promise<Array<string>> {
    const keys = [];
    const baseLevels = prefix.split('/').length;

    for (const key of Object.keys(this._db)) {
      if (key.indexOf(prefix) !== 0) {
        continue;
      }

      const levels = key.split('/').length;
      const isOnSameLevel = levels === baseLevels;

      if (!recursive && !isOnSameLevel) {
        continue;
      }

      keys.push(key);
    }

    return keys;
  }

  _init() {
    this._db = {};
  }
}
