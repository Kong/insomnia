// @flow
import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import type { BaseDriver } from './base';

export default class FileSystemDriver implements BaseDriver {
  _directory: string;

  constructor(config: { directory: string }) {
    this._directory = config.directory;
    console.log(`[FileSystemDriver] Initialized in "${this._directory}"`);
  }

  async hasItem(key: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      fs.stat(this._getKeyPath(key), (err, result) => {
        if (err && err.code === 'ENOENT') {
          resolve(false);
        } else if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  }

  setItem(key: string, value: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(this._getKeyPath(key), value, 'utf8', err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  getItem(key: string): Promise<Buffer | null> {
    return new Promise((resolve, reject) => {
      fs.readFile(this._getKeyPath(key), (err, data) => {
        if (err && err.code === 'ENOENT') {
          resolve(null);
        } else if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  removeItem(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.unlink(this._getKeyPath(key), err => {
        if (err && err.code === 'ENOENT') {
          resolve();
        } else if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  clear(): Promise<void> {
    const names = fs.readdirSync(this._directory);

    for (const name of names) {
      fs.unlinkSync(this._getKeyPath(name));
    }

    return Promise.resolve();
  }

  async keys(prefix: string): Promise<Array<string>> {
    const next = dir => {
      return new Promise(async resolve => {
        let keys: Array<string> = [];
        const names = fs.readdirSync(dir);
        for (const name of names) {
          const p = path.join(dir, name);
          if (fs.statSync(p).isDirectory()) {
            const more = await next(p);
            keys = [...keys, ...more];
          } else {
            keys.push(p);
          }
        }
        resolve(keys);
      });
    };

    const rawKeys = await next(this._getKeyPath(prefix));

    const keys = [];
    for (const rawKey of rawKeys) {
      keys.push(rawKey.substring(this._directory.length));
    }

    return keys;
  }

  _getKeyPath(key: string): string {
    const p = path.join(this._directory, key);

    // Create base directory
    mkdirp.sync(path.dirname(p));

    return p;
  }
}
