import fs from 'node:fs/promises';
import path from 'node:path';

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
    console.debug(`[FileSystemDriver] Writing to ${key}`);
    const finalPath = await this._getKeyPath(key);
    // Temp path contains randomness to avoid race-condition collisions. This
    // doesn't actually avoid race conditions but at least it won't fail.

    const tmpPath = `${finalPath}.${crypto.randomUUID()}.tmp`;
    console.debug(`[FileSystemDriver] Writing to ${tmpPath} then renaming to ${finalPath}`);
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
      keys.push(rawKey.slice(this._directory.length));
    }

    return keys;
  }

  /**
   * Resolve a store key to an absolute path, guaranteeing the result stays inside this._directory.
   * Keys can embed server-supplied identifiers, so they are treated as untrusted.
   */
  async _getKeyPath(key: string) {
    if (typeof key !== 'string' || key.includes('\0')) {
      throw new Error('Invalid store key');
    }

    const p = path.join(this._directory, key);
    this._assertLexicallyInside(p, key);

    // Make sure the base directory exists so that it can be canonicalized
    await fs.mkdir(this._directory, { recursive: true });
    const realBase = await fs.realpath(this._directory);

    // Existing ancestors may be symlinks that point outside the store. Check the nearest
    // existing ancestor BEFORE creating any directories.
    let ancestor = path.dirname(p);
    for (;;) {
      try {
        const realAncestor = await fs.realpath(ancestor);
        this._assertInside(realBase, realAncestor, key);
        break;
      } catch (err) {
        if (!(err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT')) {
          throw err;
        }

        const parent = path.dirname(ancestor);
        if (parent === ancestor) {
          throw err;
        }
        ancestor = parent;
      }
    }

    // Create base directory
    await fs.mkdir(path.dirname(p), { recursive: true });
    return p;
  }

  _assertLexicallyInside(resolvedPath: string, key: string) {
    this._assertInside(path.resolve(this._directory), path.resolve(resolvedPath), key);
  }

  _assertInside(base: string, target: string, key: string) {
    const rel = path.relative(base, target);

    if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
      throw new Error(`Store key escapes the store directory: ${JSON.stringify(key)}`);
    }
  }
}
