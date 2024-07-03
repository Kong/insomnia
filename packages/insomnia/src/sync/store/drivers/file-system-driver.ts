import fs from 'fs/promises';
import path from 'path';

import type { BaseDriver } from './base';
import { gracefulRename } from './graceful-rename';

export default class FileSystemDriver implements BaseDriver {
  _directory: string;

  private constructor(config: { directory: string }) {
    this._directory = config.directory;
    console.log(`[FileSystemDriver] Initialized in "${this._directory}"`);
  }

  static create(dataDirectory: string) {
    const directory = path.join(dataDirectory, 'version-control');
    return new FileSystemDriver({ directory });
  }

  async hasItem(key: string) {
    try {
      const stats = await fs.stat(await this._getKeyPath(key));
      const result = stats.isFile() || stats.isDirectory() || stats.isSymbolicLink();

      return result;
    } catch (err) {
      if (err && 'code' in err && err.code === 'ENOENT') {
        return false;
      }

      throw err;
    }
  }

  async setItem(key: string, value: Buffer) {
    console.log(`[FileSystemDriver] Writing to ${key}`);
    const finalPath = await this._getKeyPath(key);
      // Temp path contains randomness to avoid race-condition collisions. This
      // doesn't actually avoid race conditions but at least it won't fail.

    const tmpPath = `${finalPath}.${crypto.randomUUID()}.tmp`;
    console.log(`[FileSystemDriver] Writing to ${tmpPath} then renaming to ${finalPath}`);
      // This method implements atomic writes by first writing to a temporary
      // file (non-atomic) then renaming the file to the final value (atomic)
    try {
      await fs.writeFile(tmpPath, value, 'utf8');
      await gracefulRename(tmpPath, finalPath);
    } catch (err) {
      console.error(`[FileSystemDriver] Failed to write to ${tmpPath} then rename to ${finalPath}`, err);
      throw err;
    }
  }

  async getItem(key: string) {
    try {
      const file = await fs.readFile(await this._getKeyPath(key));
      return file;
    } catch (err) {
      if (err && 'code' in err && err.code === 'ENOENT') {
        return null;
      }

      throw err;
    }
  }

  async removeItem(key: string) {
    await fs.unlink(await this._getKeyPath(key));
  }

  async clear() {
    const files = await fs.readdir(this._directory);

    for (const fileName of files) {
      await fs.unlink(await this._getKeyPath(fileName));
    }
  }

  async keys(prefix: string, recursive: boolean) {
    const next = (dir: string) => {
      return new Promise<string[]>(async (resolve, reject) => {
        let keys: string[] = [];
        let names: string[] = [];

        try {
          names = await fs.readdir(dir);
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
          const isDir = (await fs.stat(p)).isDirectory();

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

    const rawKeys = await next(await this._getKeyPath(prefix));
    const keys: string[] = [];

    for (const rawKey of rawKeys) {
      keys.push(rawKey.substring(this._directory.length));
    }

    return keys;
  }

  async _getKeyPath(key: string) {
    const p = path.join(this._directory, key);
    // Create base directory
    await fs.mkdir(path.dirname(p), { recursive: true });
    return p;
  }
}
