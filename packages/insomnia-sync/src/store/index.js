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

  async setItem(key: string, value: JSONValue): Promise<void> {
    const ext = path.extname(key);
    const serializedValue = await this._serialize(ext, value);
    return this._driver.setItem(key, serializedValue);
  }

  async getItem(key: string): Promise<JSONValue | null> {
    const rawValue = await this.getItemRaw(key);
    if (rawValue === null) {
      return null;
    }

    const ext = path.extname(key);

    return this._deserialize(ext, rawValue);
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

  async _serialize(ext: string, raw: any): Promise<Buffer> {
    const strValue = JSON.stringify(raw, null, 2);
    let value = Buffer.from(strValue, 'utf8');
    for (const hook of this._hooks) {
      if (!hook.write) {
        continue;
      }

      value = await hook.write(ext, value);
    }

    return value;
  }

  async _deserialize(ext: string, value: Buffer): Promise<any | null> {
    for (const hook of this._hooks) {
      if (!hook.read) {
        continue;
      }

      value = await hook.read(ext, value);
    }

    return JSON.parse(value.toString('utf8'));
  }
}
