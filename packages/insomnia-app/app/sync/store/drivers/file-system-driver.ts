import fs from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';

import type { BaseDriver } from './base';

export default class FileSystemDriver implements BaseDriver {
  _directory: string;

  constructor(config: { directory: string }) {
    this._directory = config.directory;
    console.log(`[FileSystemDriver] Initialized in "${this._directory}"`);
  }

  async hasItem(key: string) {
    return new Promise<boolean>((resolve, reject) => {
      fs.stat(this._getKeyPath(key), err => {
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

  setItem(key: string, value: Buffer) {
    return new Promise<void>((resolve, reject) => {
      const finalPath = this._getKeyPath(key);

      // Temp path contains randomness to avoid race-condition collisions. This
      // doesn't actually avoid race conditions but at least it won't fail.
      const tmpPath = `${finalPath}.${Math.random()}.tmp`;
      // This method implements atomic writes by first writing to a temporary
      // file (non-atomic) then renaming the file to the final value (atomic)
      fs.writeFile(tmpPath, value, 'utf8', err => {
        if (err) {
          return reject(err);
        }

        fs.rename(tmpPath, finalPath, err => {
          if (err) {
            return reject(err);
          }

          resolve();
        });
      });
    });
  }

  getItem(key: string) {
    return new Promise<Buffer | null>((resolve, reject) => {
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

  removeItem(key: string) {
    return new Promise<void>((resolve, reject) => {
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

  clear() {
    return new Promise<void>((resolve, reject) => {
      fs.readdir(this._directory, (err, names) => {
        if (err) {
          return reject(err);
        }

        for (const name of names) {
          fs.unlinkSync(this._getKeyPath(name));
        }

        resolve();
      });
    });
  }

  async keys(prefix: string, recursive: boolean) {
    const next = dir => {
      return new Promise<string[]>(async (resolve, reject) => {
        let keys: string[] = [];
        let names: string[] = [];

        try {
          names = fs.readdirSync(dir);
        } catch (err) {
          if (err.code !== 'ENOENT') {
            reject(err);
          }
        }

        for (const name of names) {
          if (name.indexOf('.') === 0) {
            // Skip any non-vcs files
            continue;
          }

          const p = path.join(dir, name);
          const isDir = fs.statSync(p).isDirectory();

          if (isDir && recursive) {
            const more = await next(p);
            keys = [...keys, ...more];
          } else if (!recursive && isDir) {
            keys.push(p);
          } else if (!isDir) {
            keys.push(p);
          }
        }

        resolve(keys);
      });
    };

    const rawKeys = await next(this._getKeyPath(prefix));
    const keys: string[] = [];

    for (const rawKey of rawKeys) {
      keys.push(rawKey.substring(this._directory.length));
    }

    return keys;
  }

  _getKeyPath(key: string) {
    const p = path.join(this._directory, key);
    // Create base directory
    mkdirp.sync(path.dirname(p));
    return p;
  }
}
