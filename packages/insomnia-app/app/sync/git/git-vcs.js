// @flow
import * as git from 'isomorphic-git';
import fs from 'fs';
import path from 'path';
import * as db from '../../common/database';
import type { BaseModel } from '../../models';
import * as models from '../../models';
import { deterministicStringify } from '../lib/deterministicStringify';

export default class GitVCS {
  _dir: string;
  _gitdir: ?string;
  _git: Object;

  async init(directory: string, fsPlugin: Object, gitDirectory?: string) {
    this._dir = directory;
    git.plugins.set('fs', fsPlugin);
    await git.init({ dir: directory, gitdir: gitDirectory });
    this._git = git;
    this._gitdir = gitDirectory;
  }

  async listFiles(): Promise<Array<string>> {
    console.log('[git] List files');
    return git.listFiles({ dir: this._dir, gitdir: this._gitdir });
  }

  async status(): Promise<Array<[string, number, number]>> {
    console.log('[git] Status');
    return git.statusMatrix({ dir: this._dir, gitdir: this._gitdir });
  }

  async add(relPath: string): Promise<void> {
    console.log('[git] Add', relPath);
    return git.add({ dir: this._dir, gitdir: this._gitdir, filepath: relPath });
  }

  async remove(relPath: string): Promise<void> {
    console.log('[git] Remove', relPath);
    return git.remove({ dir: this._dir, gitdir: this._gitdir, filepath: relPath });
  }

  async commit(message: string, author: { name: string, email: string }): Promise<string> {
    console.log('[git] Commit', message);
    return git.commit({ dir: this._dir, gitdir: this._gitdir, message, author });
  }

  async log(depth: number = 5): Promise<string> {
    console.log('[git] Log', depth);
    return git.log({ dir: this._dir, gitdir: this._gitdir, depth: depth });
  }

  async checkout(branch: string): Promise<void> {
    console.log('[git] Checkout', branch);
    try {
      return await git.checkout({ dir: this._dir, gitdir: this._gitdir, ref: branch });
    } catch (err) {
      // Create if doesn't exist
      return git.branch({ dir: this._dir, gitdir: this._gitdir, ref: branch, checkout: true });
    }
  }
}

export class FSPlugin {
  _basePath: string;

  constructor(basePath: string) {
    this._basePath = basePath;
    console.log(`[FSPlugin] Created in ${basePath}`);
  }

  static createPlugin(basePath: string) {
    return {
      promises: new FSPlugin(basePath),
    };
  }

  readFile(filePath: string, ...x: Array<any>): Promise<Buffer | string> {
    filePath = this._joinPath(filePath);
    return fs.promises.readFile(filePath, ...x);
  }

  writeFile(filePath: string, data: Buffer | string, ...x: Array<any>) {
    filePath = this._joinPath(filePath);
    return fs.promises.writeFile(filePath, data, ...x);
  }

  unlink(filePath: string, ...x: Array<any>) {
    filePath = this._joinPath(filePath);
    return fs.promises.unlink(filePath, ...x);
  }

  readdir(filePath: string, ...x: Array<any>) {
    filePath = this._joinPath(filePath);
    return fs.promises.readdir(filePath, ...x);
  }

  mkdir(filePath: string, ...x: Array<any>) {
    filePath = this._joinPath(filePath);
    return fs.promises.mkdir(filePath, ...x);
  }

  rmdir(filePath: string, ...x: Array<any>) {
    filePath = this._joinPath(filePath);
    return fs.promises.rmdir(filePath, ...x);
  }

  stat(filePath: string, ...x: Array<any>) {
    filePath = this._joinPath(filePath);
    return (fs.promises: any).stat(filePath, ...x);
  }

  lstat(filePath: string, ...x: Array<any>) {
    filePath = this._joinPath(filePath);
    return (fs.promises: any).lstat(filePath, ...x);
  }

  readlink(filePath: string, ...x: Array<any>) {
    filePath = this._joinPath(filePath);
    return (fs.promises: any).readlink(filePath, ...x);
  }

  symlink(targetPath: string, filePath: string, ...x: Array<any>) {
    filePath = this._joinPath(filePath);
    return (fs.promises: any).symlink(targetPath, filePath, ...x);
  }

  _joinPath(filePath: string) {
    return path.join(this._basePath, filePath);
  }
}

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

/**
 * An isometric-git FS plugin that can route to various plugins depending on
 * what the filePath is.
 *
 * @param defaultFS – default plugin
 * @param otherFS – map of path prefixes to plugins
 * @returns {{promises: *}}
 */
export function routableFSPlugin(defaultFS: Object, otherFS: { [string]: Object }) {
  const execMethod = (method: string, filePath: string, ...args: Array<any>) => {
    for (const prefix of Object.keys(otherFS)) {
      if (filePath.indexOf(prefix) === 0) {
        return otherFS[prefix].promises[method](filePath, ...args);
      }
    }

    // Fallback to default if no prefix matched
    return defaultFS.promises[method](filePath, ...args);
  };

  const methods = {};

  methods.readFile = execMethod.bind(methods, 'readFile');
  methods.writeFile = execMethod.bind(methods, 'writeFile');
  methods.unlink = execMethod.bind(methods, 'unlink');
  methods.readdir = execMethod.bind(methods, 'readdir');
  methods.mkdir = execMethod.bind(methods, 'mkdir');
  methods.rmdir = execMethod.bind(methods, 'rmdir');
  methods.stat = execMethod.bind(methods, 'stat');
  methods.lstat = execMethod.bind(methods, 'lstat');
  methods.readlink = execMethod.bind(methods, 'readlink');
  methods.symlink = execMethod.bind(methods, 'symlink');

  return {
    promises: methods,
  };
}

export class NeDBPlugin {
  static createPlugin() {
    return {
      promises: new NeDBPlugin(),
    };
  }

  async _modelFromPath(filePath: string): Promise<BaseModel> {
    const segments = filePath.split('/').filter(p => p !== '');
    const modelType = segments[0];
    const modelId = segments[1];
    const model = models.getModel(modelType);

    if (!model) {
      throw new Error(`Model not exist ${filePath}`);
    }

    const doc = await db.get(modelType, modelId);

    if (!doc) {
      throw new Error(`Doc not found ${filePath}`);
    }

    return doc;
  }

  async readFile(
    filePath: string,
    options: buffer$Encoding | { encoding?: buffer$Encoding },
  ): Promise<Buffer | string> {
    options = options || {};
    if (typeof options === 'string') {
      options = { encoding: options };
    }

    const segments = filePath.split('/').filter(p => p !== '');
    let latestDocs = [];
    for (let i = 0; i < segments.length; i += 2) {
      const [modelType, modelId] = segments;
      console.log('SEARCHING', modelType, modelId);

      const model = models.getModel(modelType);

      if (modelId) {
        throw new Error(`Not a directory ${filePath}`);
      }

      if (!model) {
        throw new Error(`Model not exist ${filePath}`);
      }

      latestDocs = await db.all(modelType);
      console.log('LATEST DOCS', latestDocs);
    }

    // return latestDocs.map(doc => `${doc._id}.json`);

    const doc = await this._modelFromPath(filePath);
    const raw = Buffer.from(deterministicStringify(doc), 'utf8');

    if (options.encoding) {
      return raw.toString(options.encoding);
    } else {
      return raw;
    }
  }

  async writeFile(filePath: string, data: Buffer | string, ...x: Array<any>): Promise<void> {
    throw new Error('NeDBPlugin is not writable');
  }

  async unlink(filePath: string, ...x: Array<any>): Promise<void> {
    throw new Error('NeDBPlugin is not writable');
  }

  async readdir(filePath: string, ...x: Array<any>): Promise<Array<string>> {
    const MODELS = [
      models.workspace.type,
      models.environment.type,
      models.requestGroup.type,
      models.request.type,
      models.apiSpec.type,
    ];

    if (filePath === '/') {
      return MODELS;
    }

    const segments = filePath.split('/');

    let latestItems = [];
    // console.log('\n\n---------------------------', segments);
    for (let i = 0; i < segments.length; i += 2) {
      latestItems = [];
      const parentId = segments[i];
      const modelType = segments[i + 1];
      const modelId = segments[i + 2];
      // console.log('SEARCHING', { parentId, modelType, modelId });

      if (!modelType) {
        latestItems = MODELS;
        continue;
      }

      const model = models.getModel(modelType);

      if (!model) {
        throw new Error(`Model not exist ${filePath}`);
      }

      if (modelId && modelId.match(/\.json$/)) {
        throw new Error(`Not a directory ${filePath}`);
      }

      if (modelId) {
        latestItems = [`${modelId}.json`, ...MODELS];
      } else {
        for (const doc of await db.find(modelType, { parentId: parentId || null })) {
          latestItems.push(doc._id + '.json');
          latestItems.push(doc._id);
        }
      }

      // console.log('LATEST DOCS', latestItems);
    }

    return latestItems.sort();

    // const toReturn = MODELS;
    // for (const doc of latestDocs) {
    //   // Add doc first
    //   toReturn.push(`${doc._id}.json`);
    //
    //   for (const type of MODELS) {
    //     toReturn.push(type);
    //   }
    // }
    //
    // return toReturn;
    // return [];
  }

  async mkdir(filePath: string, ...x: Array<any>) {
    throw new Error('NeDBPlugin is not writable');
  }

  async rmdir(filePath: string, ...x: Array<any>) {
    throw new Error('NeDBPlugin is not writable');
  }

  async stat(filePath: string, ...x: Array<any>): Promise<Stat> {
    const segments = filePath.split('/').filter(p => p !== '');
    const modelType = segments[0];
    const modelId = segments[1];
    const model = models.getModel(modelType);

    if (!model) {
      throw new Error(`Invalid model ${filePath}`);
    }

    if (!modelId && model) {
      return new Stat({
        type: 'dir',
        mode: 0o777,
        size: 0,
        ino: 0,
        mtimeMs: 0,
      });
    }

    const doc = await db.get(modelType, modelId);
    if (!doc) {
      throw new Error(`Doc not found ${filePath}`);
    }

    const raw = Buffer.from(deterministicStringify(doc), 'utf8');
    return new Stat({
      type: 'file',
      mode: 0o777,
      size: raw.length,
      ino: doc._id,
      mtimeMs: doc.modified,
    });
  }

  async lstat(filePath: string, ...x: Array<any>) {
    return this.stat(filePath, ...x);
  }

  async readlink(filePath: string, ...x: Array<any>) {
    throw new Error('NeDBPlugin is not writable');
  }

  async symlink(targetPath: string, filePath: string, ...x: Array<any>) {
    throw new Error('NeDBPlugin is not writable');
  }
}

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
      path: '/',
      name: '',
      children: [],
      ino: this.__ino,
      mtimeMs: Date.now(),
    };
  }

  async tree(baseDir: string = '/') {
    const next = async (dir: string, toPrint: string): Promise<string> => {
      const entry = this._find(dir);

      if (!entry) {
        return toPrint;
      }

      let indent = new Array((dir.match(/\//g) || []).length).join('|   ');
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
    options: buffer$Encoding | { encoding?: buffer$Encoding },
  ): Promise<Buffer | string> {
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
    this._remove(this._assertFile(filePath));
  }

  async readdir(basePath: string, ...x: Array<any>): Promise<Array<string>> {
    const entry = this._assertDir(basePath);

    const names = entry.children.map(c => c.name);
    names.sort();
    return names;
  }

  async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
    const doRecursive = (options || {}).recursive || false;

    // If not recursive, ensure parent exists
    if (!doRecursive) {
      this._assertDir(path.dirname(dirPath));
    }

    const pathSegments = dirPath.split('/').filter(s => s !== '');

    // Recurse over all subpaths, ensure they are all directories,
    // create them if they don't exist
    let currentPath = '';
    for (const pathSegment of pathSegments) {
      const dirEntry = this._assertDir(currentPath);
      const nextPath = currentPath + '/' + pathSegment;

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
    return this._statEntry(this._assertExists(filePath));
  }

  async lstat(filePath: string, ...x: Array<any>) {
    const linkEntry = this._assertExists(filePath);
    return this._statEntry(this._resolveLinks(linkEntry));
  }

  async readlink(filePath: string, ...x: Array<any>) {
    const linkEntry = this._assertSymlink(filePath);
    return linkEntry.linkTo;
  }

  async symlink(target: string, filePath: string, ...x: Array<any>) {
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
    let current = this.__fs;
    const pathSegments = filePath.split('/').filter(s => s !== '');
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

type StatObj = {
  type: 'file' | 'dir' | 'symlink',
  mode: number,
  size: number,
  ino: number,
  mtimeMs: number,
  ctimeMs?: number,
};

class Stat {
  type: 'file' | 'dir' | 'symlink';
  mode: number;
  size: number;
  ino: number;
  mtimeMs: number;
  ctimeMs: number;
  uid: 1;
  gid: 1;
  dev: 1;

  constructor(stats: StatObj) {
    this.type = stats.type;
    this.mode = stats.mode;
    this.size = stats.size;
    this.ino = stats.ino;
    this.mtimeMs = stats.mtimeMs;
    this.ctimeMs = stats.ctimeMs || stats.mtimeMs;
    this.uid = 1;
    this.gid = 1;
    this.dev = 1;
  }

  isFile() {
    return this.type === 'file';
  }

  isDirectory() {
    return this.type === 'dir';
  }

  isSymbolicLink() {
    return this.type === 'symlink';
  }
}
