import { PromiseFsClient } from 'isomorphic-git';
import path from 'path';

import Stat from './stat';
import { SystemError } from './system-error';
import { BufferEncoding } from './utils';

interface FSFile {
  readonly type: 'file';
  readonly ino: number;
  readonly mtimeMs: number;
  readonly name: string;
  readonly path: string;
  contents: string;
}

interface FSLink {
  readonly type: 'symlink';
  readonly ino: number;
  readonly mtimeMs: number;
  readonly name: string;
  readonly path: string;
  readonly linkTo: string;
}

interface FSDir {
  readonly type: 'dir';
  readonly ino: number;
  readonly mtimeMs: number;
  readonly name: string;
  readonly path: string;
  readonly children: (FSFile | FSDir | FSLink)[];
}

type FSEntry = FSDir | FSFile | FSLink;

export class MemClient {
  __fs: FSEntry;
  __ino: 0;

  static createClient(): PromiseFsClient {
    return {
      promises: new MemClient(),
    };
  }

  constructor() {
    this.__ino = 0;
    this.__fs = {
      type: 'dir',
      path: path.normalize('/'),
      name: '',
      children: [],
      ino: this.__ino,
      mtimeMs: Date.now(),
    };
  }

  async tree(baseDir = '/') {
    baseDir = path.normalize(baseDir);

    const next = async (dir: string, toPrint: string) => {
      const entry = this._find(dir);

      if (!entry) {
        return toPrint;
      }

      const indent = new Array((dir.match(/\//g) || []).length).join('|   ');

      if (entry.type === 'dir') {
        if (entry.path !== baseDir) {
          toPrint += `${indent}${entry.name}/\n`;
        }

        for (const name of await this.readdir(dir)) {
          toPrint = await next(path.join(dir, name), toPrint);
        }
      } else {
        toPrint += `${indent}${entry.name}\n`;
      }

      return toPrint;
    };

    console.log(await next(baseDir, ''));
  }

  async readFile(
    filePath: string,
    options: BufferEncoding | { encoding?: BufferEncoding } = {},
  ) {
    filePath = path.normalize(filePath);

    if (typeof options === 'string') {
      options = {
        encoding: options,
      };
    }

    const encoding = options ? options.encoding : null;

    const entry = this._assertFile(filePath);

    const raw = Buffer.from(entry.contents, 'base64');

    if (encoding) {
      return raw.toString(encoding);
    } else {
      return raw;
    }
  }

  async writeFile(
    filePath: string,
    data: Buffer | string,
    options: BufferEncoding | { encoding?: BufferEncoding; flag?: string } = {},
  ) {
    filePath = path.normalize(filePath);

    if (typeof options === 'string') {
      options = {
        encoding: options,
      };
    }

    const flag = options && options.flag ? options.flag : 'w';
    const encoding = options && options.encoding ? options.encoding : 'utf8';

    // Make sure file doesn't exist for "x" flags
    if (flag[1] === 'x') {
      await this._assertDoesNotExist(filePath);
    }

    const dirEntry: FSDir = this._assertDir(path.dirname(filePath));

    let file: FSEntry | null = this._find(filePath);

    if (file) {
      file = this._assertFileEntry(file);
    } else {
      const name = path.basename(filePath);
      file = {
        name,
        type: 'file',
        ino: this.__ino++,
        mtimeMs: Date.now(),
        contents: '',
        path: filePath,
      };
      dirEntry.children.push(file);
    }

    const dataBuff: Buffer = data instanceof Buffer ? data : Buffer.from(data, encoding);
    let newContents = Buffer.alloc(0);

    if (flag[0] === 'w') {
      newContents = dataBuff;
    } else if (flag[0] === 'a') {
      const contentsBuff: Buffer = Buffer.from(file.contents, 'base64');
      newContents = Buffer.concat([contentsBuff, dataBuff]);
    } else {
      throw new SystemError({
        code: 'EBADF',
        errno: -9,
        message: 'EBADF: bad file descriptor, write',
        path: filePath,
        syscall: 'write',
      });
    }

    file.contents = newContents.toString('base64');
    return Promise.resolve();
  }

  async unlink(filePath: string) {
    filePath = path.normalize(filePath);

    this._remove(this._assertFile(filePath));
  }

  async readdir(basePath: string) {
    basePath = path.normalize(basePath);

    const entry = this._assertDir(basePath);

    const names = entry.children.map(c => c.name);
    names.sort();
    return names;
  }

  async mkdir(dirPath: string, options?: { recursive?: boolean }) {
    dirPath = path.normalize(dirPath);
    const doRecursive = (options || {}).recursive || false;

    // If not recursive, ensure parent exists
    if (!doRecursive) {
      this._assertDir(path.dirname(dirPath));
    }

    const pathSegments = dirPath.split(path.sep).filter(s => s !== '');
    // Recurse over all sub paths, ensure they are all directories,
    // create them if they don't exist
    let currentPath = '/';

    for (const pathSegment of pathSegments) {
      const dirEntry = this._assertDir(currentPath);

      const nextPath = path.join(currentPath, pathSegment);

      // Create dir if it doesn't exist yet
      if (!dirEntry.children.find(e => e.name === pathSegment)) {
        dirEntry.children.push({
          type: 'dir',
          ino: this.__ino++,
          mtimeMs: Date.now(),
          name: pathSegment,
          path: nextPath,
          children: [],
        });
      }

      currentPath = nextPath;
    }
  }

  async rmdir(dirPath: string) {
    dirPath = path.normalize(dirPath);

    const dirEntry = this._assertDir(dirPath);

    if (dirEntry.children.length > 0) {
      throw new SystemError({
        code: 'ENOTEMPTY',
        errno: -66,
        message: `ENOTEMPTY: directory not empty, rmdir '${dirPath}'`,
        path: dirPath,
        syscall: 'rmdir',
      });
    }

    this._remove(dirEntry);
  }

  async stat(filePath: string) {
    filePath = path.normalize(filePath);
    return this._statEntry(this._assertExists(filePath));
  }

  async lstat(filePath: string) {
    filePath = path.normalize(filePath);

    const linkEntry = this._assertExists(filePath);

    return this._statEntry(this._resolveLinks(linkEntry));
  }

  async readlink(filePath: string) {
    filePath = path.normalize(filePath);

    const linkEntry = this._assertSymlink(filePath);

    return linkEntry.linkTo;
  }

  async symlink(target: string, filePath: string) {
    filePath = path.normalize(filePath);

    // Make sure we don't already have one there
    // TODO: Check what to do in this case (might be wrong)
    this._assertDoesNotExist(filePath);

    this._assertExists(target);

    const parentEntry = this._assertDir(path.dirname(filePath));

    parentEntry.children.push({
      type: 'symlink',
      ino: this.__ino++,
      mtimeMs: Date.now(),
      name: path.basename(filePath),
      path: filePath,
      linkTo: target,
    });
  }

  _statEntry(entry: FSEntry) {
    return new Stat({
      type: entry.type,
      mode: 0o777,
      // @ts-expect-error -- TSCONVERSION
      size: entry.contents ? entry.contents.length : 0,
      ino: entry.ino,
      mtimeMs: entry.mtimeMs,
    });
  }

  _find(filePath: string) {
    filePath = path.normalize(filePath);
    let current = this.__fs;
    // Ignore empty and current directory '.' segments
    const pathSegments = filePath.split(path.sep).filter(s => s !== '' && s !== '.');

    for (const expectedName of pathSegments) {
      // @ts-expect-error -- TSCONVERSION
      const e = (current.children || []).find(c => c.name === expectedName);

      if (!e) {
        return null;
      }

      current = e;
    }

    // It's the root
    return current;
  }

  _assertDoesNotExist(filePath: string) {
    const entry = this._find(filePath);

    if (entry) {
      throw new SystemError({
        code: 'EEXIST',
        errno: -17,
        message: `EEXIST: file already exists, open '${filePath}'`,
        path: filePath,
        syscall: 'open',
      });
    }
  }

  _assertExists(filePath: string) {
    const entry = this._find(filePath);

    if (!entry) {
      throw new SystemError({
        code: 'ENOENT',
        errno: -2,
        message: `ENOENT: no such file or directory, scandir '${filePath}'`,
        path: filePath,
        syscall: 'scandir',
      });
    }

    return entry;
  }

  _assertDirEntry(entry: FSEntry) {
    if (entry.type !== 'dir') {
      throw new SystemError({
        code: 'ENOTDIR',
        errno: -20,
        message: `ENOTDIR: not a directory, scandir '${entry.path}'`,
        path: entry.path,
        syscall: 'scandir',
      });
    }

    return entry;
  }

  _assertDir(filePath: string) {
    const entry = this._assertExists(filePath);

    return this._assertDirEntry(entry);
  }

  _assertSymlinkEntry(entry: FSEntry) {
    if (entry.type !== 'symlink') {
      throw new SystemError({
        code: 'ENOTDIR',
        errno: -20,
        message: `ENOTDIR: not a symlink, scandir '${entry.path}'`,
        path: entry.path,
        syscall: 'scandir',
      });
    }

    return entry;
  }

  _assertSymlink(filePath: string) {
    const entry = this._assertExists(filePath);

    return this._assertSymlinkEntry(entry);
  }

  _resolveLinks(entry: FSEntry): FSFile | FSDir {
    if (entry.type === 'symlink') {
      const other = this._find(entry.linkTo);

      if (!other) {
        // Should never happen
        throw new Error('Failed to resolve link');
      }

      return this._resolveLinks(other);
    }

    return entry;
  }

  _assertFileEntry(entry: FSEntry) {
    entry = this._resolveLinks(entry);

    if (entry.type === 'dir') {
      throw new SystemError({
        code: 'EISDIR',
        errno: -21,
        message: `EISDIR: illegal operation on a directory '${entry.path}'`,
        path: entry.path,
        syscall: 'open',
      });
    }

    return entry;
  }

  _assertFile(filePath: string) {
    const entry = this._assertExists(filePath);

    return this._assertFileEntry(entry);
  }

  _remove(entry: FSEntry) {
    const parentEntry = this._assertDir(path.dirname(entry.path));

    const index = parentEntry.children.findIndex(c => c === entry);

    if (index < 0) {
      // Should never happen so w/e
      return;
    }

    parentEntry.children.splice(index, 1);
  }
}
