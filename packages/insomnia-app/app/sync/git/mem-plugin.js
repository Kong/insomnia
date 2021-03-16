// @flow
import path from 'path';
import Stat from './stat';

type FSFile = {|
  +type: 'file',
  +ino: number,
  +mtimeMs: number,
  +name: string,
  +path: string,
  contents: string,
|};

type FSLink = {|
  +type: 'symlink',
  +ino: number,
  +mtimeMs: number,
  +name: string,
  +path: string,
  +linkTo: string,
|};

type FSDir = {|
  +type: 'dir',
  +ino: number,
  +mtimeMs: number,
  +name: string,
  +path: string,
  +children: Array<FSFile | FSDir | FSLink>,
|};

type FSEntry = FSDir | FSFile | FSLink;

export class MemPlugin {
  __fs: FSEntry;
  __ino: 0;

  static createPlugin() {
    return {
      promises: new MemPlugin(),
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

  async tree(baseDir: string = '/') {
    baseDir = path.normalize(baseDir);

    const next = async (dir: string, toPrint: string): Promise<string> => {
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
    options?: buffer$Encoding | { encoding?: buffer$Encoding } = {},
  ): Promise<Buffer | string> {
    filePath = path.normalize(filePath);

    if (typeof options === 'string') {
      options = { encoding: options };
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
    options: buffer$Encoding | { encoding?: buffer$Encoding, flag?: string },
  ): Promise<void> {
    filePath = path.normalize(filePath);

    if (typeof options === 'string') {
      options = { encoding: options };
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
      const e: ErrnoError = new Error('EBADF: bad file descriptor, write');
      e.errno = -9;
      e.code = 'EBADF';
      e.syscall = 'write';
      e.path = filePath;
      throw e;
    }

    file.contents = newContents.toString('base64');

    return Promise.resolve();
  }

  async unlink(filePath: string, ...x: Array<any>): Promise<void> {
    filePath = path.normalize(filePath);
    this._remove(this._assertFile(filePath));
  }

  async readdir(basePath: string, ...x: Array<any>): Promise<Array<string>> {
    basePath = path.normalize(basePath);
    const entry = this._assertDir(basePath);

    const names = entry.children.map(c => c.name);
    names.sort();
    return names;
  }

  async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
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

  async rmdir(dirPath: string, ...x: Array<any>) {
    dirPath = path.normalize(dirPath);

    const dirEntry = this._assertDir(dirPath);

    if (dirEntry.children.length > 0) {
      const e: ErrnoError = new Error(`ENOTEMPTY: directory not empty, rmdir '${dirPath}'`);
      e.errno = -66;
      e.syscall = 'rmdir';
      e.code = 'ENOTEMPTY';
      e.path = dirPath;
      throw e;
    }

    this._remove(dirEntry);
  }

  async stat(filePath: string, ...x: Array<any>): Promise<Stat> {
    filePath = path.normalize(filePath);
    return this._statEntry(this._assertExists(filePath));
  }

  async lstat(filePath: string, ...x: Array<any>) {
    filePath = path.normalize(filePath);
    const linkEntry = this._assertExists(filePath);
    return this._statEntry(this._resolveLinks(linkEntry));
  }

  async readlink(filePath: string, ...x: Array<any>) {
    filePath = path.normalize(filePath);
    const linkEntry = this._assertSymlink(filePath);
    return linkEntry.linkTo;
  }

  async symlink(target: string, filePath: string, ...x: Array<any>) {
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

  _statEntry(entry: FSEntry): Stat {
    return new Stat({
      type: entry.type,
      mode: 0o777,
      size: entry.contents ? entry.contents.length : 0,
      ino: entry.ino,
      mtimeMs: entry.mtimeMs,
    });
  }

  _find(filePath: string): FSEntry | null {
    filePath = path.normalize(filePath);

    let current = this.__fs;

    // Ignore empty and current directory '.' segments
    const pathSegments = filePath.split(path.sep).filter(s => s !== '' && s !== '.');
    for (const expectedName of pathSegments) {
      const e = (current.children || []).find(c => c.name === expectedName);

      if (!e) {
        return null;
      }

      current = e;
    }

    // It's the root
    return current;
  }

  _assertDoesNotExist(filePath: string): void {
    const entry = this._find(filePath);

    if (entry) {
      const e: ErrnoError = new Error(`EEXIST: file already exists, open '${filePath}'`);
      e.errno = -17;
      e.code = 'EEXIST';
      e.syscall = 'open';
      e.path = filePath;
      throw e;
    }
  }

  _assertExists(filePath: string): FSEntry {
    const entry = this._find(filePath);

    if (!entry) {
      const e: ErrnoError = new Error(`ENOENT: no such file or directory, scandir '${filePath}'`);
      e.errno = -2;
      e.code = 'ENOENT';
      e.syscall = 'scandir';
      e.path = filePath;
      throw e;
    }

    return entry;
  }

  _assertDirEntry(entry: FSEntry): FSDir {
    if (entry.type !== 'dir') {
      const e: ErrnoError = new Error(`ENOTDIR: not a directory, scandir '${entry.path}'`);
      e.errno = -20;
      e.code = 'ENOTDIR';
      e.syscall = 'scandir';
      e.path = entry.path;
      throw e;
    }

    return entry;
  }

  _assertDir(filePath: string): FSDir {
    const entry = this._assertExists(filePath);
    return this._assertDirEntry(entry);
  }

  _assertSymlinkEntry(entry: FSEntry): FSLink {
    if (entry.type !== 'symlink') {
      const e: ErrnoError = new Error(`ENOTDIR: not a simlink, scandir '${entry.path}'`);
      e.errno = -20;
      e.code = 'ENOTDIR';
      e.syscall = 'scandir';
      e.path = entry.path;
      throw e;
    }

    return entry;
  }

  _assertSymlink(filePath: string): FSLink {
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

  _assertFileEntry(entry: FSEntry): FSFile {
    entry = this._resolveLinks(entry);

    if (entry.type === 'dir') {
      const e: ErrnoError = new Error(`EISDIR: illegal operation on a directory '${entry.path}'`);
      e.errno = -21;
      e.code = 'EISDIR';
      e.syscall = 'open';
      e.path = entry.path;
      throw e;
    }

    return entry;
  }

  _assertFile(filePath: string): FSFile {
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
