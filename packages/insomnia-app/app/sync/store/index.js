// @flow

import path from 'path';
import type { BaseDriver } from './drivers/base';

// Can't really make this any more specific unfortunately
type JSONValue = any;
export type HookFn = (extension: string, value: Buffer) => Promise<Buffer>;
export type Hook = { read: HookFn, write: HookFn };

export default class Store {
  _driver: BaseDriver;
  _hooks: Array<Hook>;

  constructor(driver: BaseDriver, hooks?: Array<Hook>) {
    this._driver = driver;
    this._hooks = hooks || [];
  }

  async hasItem(key: string): Promise<boolean> {
    return this._driver.hasItem(key);
  }

  async setItem(key: string, value: JSONValue | Buffer): Promise<void> {
    const ext = path.extname(key);
    let serializedValue;
    try {
      serializedValue = await this._serialize(ext, value);
    } catch (err) {
      throw new Error(`Failed to serialize key=${key} err=${err}`);
    }

    return this._driver.setItem(key, serializedValue);
  }

  async setItemRaw(key: string, value: Buffer): Promise<void> {
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

  async removeItem(key: string): Promise<void> {
    return this._driver.removeItem(key);
  }

  async keys(prefix: string): Promise<Array<string>> {
    return this._driver.keys(prefix);
  }

  async clear(): Promise<void> {
    return this._driver.clear();
  }

  async _serialize(ext: string, raw: JSONValue | Buffer): Promise<Buffer> {
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
