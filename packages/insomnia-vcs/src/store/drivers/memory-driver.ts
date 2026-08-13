import type { BaseDriver } from './base';
export default class MemoryDriver implements BaseDriver {
  // TODO: unsound definite property assignment assertion
  _db!: Record<string, Buffer>;

  constructor() {
    this._init();
  }

  async hasItem(key: string) {
    return this._db[String(key)] instanceof Buffer;
  }

  async setItem(key: string, value: Buffer) {
    this._db[String(key)] = value;
  }

  async getItem(key: string) {
    let value: Buffer | null = null;

    if (await this.hasItem(key)) {
      value = this._db[key];
    }

    return value;
  }

  async removeItem(key: string) {
    delete this._db[String(key)];
  }

  async clear() {
    this._init();
  }

  async keys(prefix: string, recursive: boolean) {
    const keys: string[] = [];
    const baseLevels = prefix.split('/').length;

    for (const key of Object.keys(this._db)) {
      if (key.indexOf(prefix) !== 0) {
        continue;
      }

      const levels = key.split('/').length;
      const isInBaseLevel = levels === baseLevels + 1;

      if (!recursive && !isInBaseLevel) {
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
