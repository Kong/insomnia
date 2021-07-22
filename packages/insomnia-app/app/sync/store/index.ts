import path from 'path';

import type { BaseDriver } from './drivers/base';

// Can't really make this any more specific unfortunately
type JSONValue = any;

export type HookFn = (extension: string, value: Buffer) => Promise<Buffer>;

export interface Hook {
  read: HookFn;
  write: HookFn;
}

export default class Store {
  _driver: BaseDriver;
  _hooks: Hook[];

  constructor(driver: BaseDriver, hooks?: Hook[]) {
    this._driver = driver;
    this._hooks = hooks || [];
  }

  async hasItem(key: string) {
    return this._driver.hasItem(key);
  }

  async setItem(key: string, value: JSONValue | Buffer) {
    const ext = path.extname(key);
    let serializedValue;

    try {
      serializedValue = await this._serialize(ext, value);
    } catch (err) {
      throw new Error(`Failed to serialize key=${key} err=${err}`);
    }

    return this._driver.setItem(key, serializedValue);
  }

  async setItemRaw(key: string, value: Buffer) {
    return this._driver.setItem(key, value);
  }

  async getItem(key: string): Promise<JSONValue | null> {
    const rawValue = await this.getItemRaw(key);

    if (rawValue === null) {
      return null;
    }

    const ext = path.extname(key);
    let value;

    try {
      // Without the `await` here, the catch won't get called
      value = await this._deserialize(ext, rawValue);
    } catch (err) {
      console.log('Failed to deserialize', rawValue.toString('base64'));
      throw new Error(`Failed to deserialize key=${key} err=${err}`);
    }

    return value;
  }

  async getItemRaw(key: string): Promise<Buffer | null> {
    return this._driver.getItem(key);
  }

  async removeItem(key: string) {
    return this._driver.removeItem(key);
  }

  async keys(prefix: string, recursive = true) {
    return this._driver.keys(prefix, recursive);
  }

  async clear() {
    return this._driver.clear();
  }

  async _serialize(ext: string, raw: JSONValue | Buffer) {
    let buff = raw instanceof Buffer ? raw : Buffer.from(JSON.stringify(raw, null, 2), 'utf8');

    for (const hook of this._hooks) {
      if (!hook.write) {
        continue;
      }

      buff = await hook.write(ext, buff);
    }

    return buff;
  }

  async _deserialize(ext: string, value: Buffer): Promise<JSONValue | null> {
    for (const hook of this._hooks) {
      if (!hook.read) {
        continue;
      }

      value = await hook.read(ext, value);
    }

    return JSON.parse(value.toString('utf8'));
  }
}
