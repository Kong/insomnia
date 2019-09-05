// @flow
import * as git from 'isomorphic-git';
import fs from 'fs';
import path from 'path';
import * as db from '../../common/database';
import * as models from '../../models';
import stringifyJSON from 'json-stable-stringify';

export type GitAuthor = {|
  name: string,
  email: string,
|};

export type GitRemoteConfig = {|
  remote: string,
  url: string,
|};

export type GitLogEntry = {|
  oid: string,
  message: string,
  author: GitAuthor & {
    timestamp: number,
  },
|};

export type GitStatusEntry = [string, number, number, number];

export default class GitVCS {
  _git: Object;

  _baseOpts: { dir: string, gitdir?: string };

  async init(directory: string, fsPlugin: Object, gitDirectory?: string) {
    // Default gitDirectory to <directory>/.git
    gitDirectory = gitDirectory || path.join(directory, '.git');

    this._git = git;
    git.plugins.set('fs', fsPlugin);

    this._baseOpts = { dir: directory, gitdir: gitDirectory };

    if (await this._repoExists()) {
      console.log(`[git] Opened repo for ${gitDirectory}`);
    } else {
      console.log(`[git] Initialized repo in ${gitDirectory}`);
      await git.init({ ...this._baseOpts });
    }
  }

  async getGitDirectory() {
    return this._baseOpts.gitdir;
  }

  async listFiles(): Promise<Array<string>> {
    console.log('[git] List files');
    return git.listFiles({ ...this._baseOpts });
  }

  async branch(): Promise<string> {
    const branch = await git.currentBranch({ ...this._baseOpts });
    if (typeof branch !== 'string') {
      throw new Error('No active branch');
    }

    return branch;
  }

  async status(path?: string): Promise<Array<GitStatusEntry>> {
    console.log('[git] Status');
    return git.statusMatrix({ ...this._baseOpts, pattern: path });
  }

  async add(relPath: string): Promise<void> {
    console.log(`[git] Add ${relPath}`);
    return git.add({ ...this._baseOpts, filepath: relPath });
  }

  async remove(relPath: string): Promise<void> {
    console.log(`[git] Remove relPath=${relPath}`);
    return git.remove({ ...this._baseOpts, filepath: relPath });
  }

  async addRemote(name: string, url: string): Promise<GitRemoteConfig> {
    console.log(`[git] Add Remote name=${name} url=${url}`);
    await git.addRemote({ ...this._baseOpts, remote: name, url, force: true });
    const config = await this.getRemote(name);

    if (config === null) {
      // Should never happen but it's here to make Flow happy
      throw new Error('Remote not found ' + name);
    }

    return config;
  }

  async listRemotes(): Promise<Array<GitRemoteConfig>> {
    return git.listRemotes({ ...this._baseOpts });
  }

  async getAuthor(): Promise<GitAuthor> {
    const name = await git.config({ ...this._baseOpts, path: 'user.name' });
    const email = await git.config({ ...this._baseOpts, path: 'user.email' });
    return {
      name: name || '',
      email: email || '',
    };
  }

  async setAuthor(name: string, email: string): Promise<void> {
    await git.config({ ...this._baseOpts, path: 'user.name', value: name });
    await git.config({ ...this._baseOpts, path: 'user.email', value: email });
  }

  async getRemote(name: string): Promise<GitRemoteConfig | null> {
    const remotes = await this.listRemotes();
    return remotes.find(r => r.remote === name) || null;
  }

  async commit(message: string, author?: GitAuthor): Promise<string> {
    console.log(`[git] Commit "${message}"`);
    return git.commit({ ...this._baseOpts, message, author });
  }

  async push(remote: string, token?: string | null): Promise<Object> {
    console.log(`[git] Push remote=${remote} token=${(token || '').replace(/./g, '*')}`);
    return git.push({ ...this._baseOpts, remote, token, force: true });
  }

  async pull(remote: string, token?: string | null): Promise<void> {
    console.log(`[git] Pull remote=${remote} token=${(token || '').replace(/./g, '*')}`);

    return git.pull({ ...this._baseOpts, remote, token, singleBranch: true });
  }

  async log(depth: number = 5): Promise<Array<GitLogEntry> | null> {
    console.log(`[git] Log depth=${depth}`);
    let err = null;
    let log = null;

    try {
      log = await git.log({ ...this._baseOpts, depth: depth });
    } catch (e) {
      err = e;
    }

    if (err && err.code === 'ResolveRefError') {
      return null;
    }

    if (err) {
      throw err;
    } else {
      return log;
    }
  }

  async checkout(branch: string): Promise<void> {
    console.log('[git] Checkout', { branch });
    try {
      return await git.checkout({ ...this._baseOpts, ref: branch });
    } catch (err) {
      // Create if doesn't exist
      return git.branch({ ...this._baseOpts, ref: branch, checkout: true });
    }
  }

  async readObjFromTree(treeOid: string, objPath: string): Object | null {
    const tree: Object | null = await this._readObject(treeOid);
    if (!tree) {
      return null;
    }

    const entry = tree.entries.find(e => e.path === objPath);
    if (!entry) {
      console.log(`[git] Entry not found ${objPath}`);
      return null;
    }

    return this._readObject(entry.oid, 'utf8');
  }

  async _readObject<T>(oid: string, encoding?: 'utf8'): Promise<T | null> {
    let gitObj = null;
    try {
      gitObj = await git.readObject({ ...this._baseOpts, oid, encoding });
    } catch (err) {
      return null;
    }

    return gitObj.object;
  }

  async _repoExists() {
    try {
      await git.config({ ...this._baseOpts, path: '' });
    } catch (err) {
      return false;
    }

    return true;
  }
}

export class FSPlugin {
  _basePath: string;

  constructor(basePath?: string = '/') {
    this._basePath = basePath;
    console.log(`[FSPlugin] Created in ${basePath}`);
  }

  static createPlugin(basePath?: string = '/') {
    return {
      promises: new FSPlugin(basePath),
    };
  }

  async readFile(filePath: string, ...x: Array<any>): Promise<Buffer | string> {
    return this._callbackAsPromise(fs.readFile, filePath, ...x);
  }

  async writeFile(filePath: string, data: Buffer | string, ...x: Array<any>) {
    return this._callbackAsPromise(fs.writeFile, filePath, data, ...x);
  }

  async unlink(filePath: string, ...x: Array<any>) {
    return this._callbackAsPromise(fs.unlink, filePath, ...x);
  }

  async readdir(filePath: string, ...x: Array<any>) {
    return this._callbackAsPromise(fs.readdir, filePath, ...x);
  }

  async mkdir(filePath: string, ...x: Array<any>) {
    return this._callbackAsPromise(fs.mkdir, filePath, ...x);
  }

  async rmdir(filePath: string, ...x: Array<any>) {
    return this._callbackAsPromise(fs.rmdir, filePath, ...x);
  }

  async stat(filePath: string, ...x: Array<any>) {
    return this._callbackAsPromise(fs.stat, filePath, ...x);
  }

  async lstat(filePath: string, ...x: Array<any>) {
    return this._callbackAsPromise(fs.lstat, filePath, ...x);
  }

  async readlink(filePath: string, ...x: Array<any>) {
    return this._callbackAsPromise(fs.readlink, filePath, ...x);
  }

  async symlink(targetPath: string, filePath: string, ...x: Array<any>) {
    return this._callbackAsPromise(fs.symlink, filePath, ...x);
  }

  _callbackAsPromise<T>(fn: Function, filePath: string, ...args: Array<any>): Promise<T> {
    return new Promise((resolve, reject) => {
      filePath = path.join(this._basePath, path.normalize(filePath));
      const callback = args.find(arg => typeof arg === 'function');
      const newArgs = args.filter(arg => arg !== callback);

      fn(filePath, ...newArgs, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
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
    filePath = path.normalize(filePath);

    for (const prefix of Object.keys(otherFS)) {
      if (filePath.indexOf(prefix) === 0) {
        // console.log('FS', method, filePath);
        return otherFS[prefix].promises[method](filePath, ...args);
      }
    }

    // Fallback to default if no prefix matched
    // console.log('NeDB', method, filePath);
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
  _workspaceId: string;

  constructor(workspaceId: string) {
    if (!workspaceId) {
      throw new Error('Cannot use NeDBPlugin without workspace ID');
    }
    this._workspaceId = workspaceId;
  }

  static createPlugin(workspaceId: string) {
    return {
      promises: new NeDBPlugin(workspaceId),
    };
  }

  async readFile(
    filePath: string,
    options?: buffer$Encoding | { encoding?: buffer$Encoding },
  ): Promise<Buffer | string> {
    filePath = path.normalize(filePath);

    options = options || {};
    if (typeof options === 'string') {
      options = { encoding: options };
    }

    const { type, id } = this._parsePath(filePath);

    if (id === null || type === null) {
      throw new Error(`Cannot read from directory or missing ${filePath}`);
    }

    const doc = await db.get(type, id);

    if (!doc) {
      throw new Error(`Cannot find doc ${filePath}`);
    }

    if (doc.type !== models.workspace.type) {
      const ancestors = await db.withAncestors(doc);
      if (!ancestors.find(d => d.type === models.workspace.type)) {
        throw new Error(`Not found under workspace ${filePath}`);
      }
    }

    const raw = Buffer.from(stringifyJSON(doc, { space: '  ' }), 'utf8');

    if (options.encoding) {
      return raw.toString(options.encoding);
    } else {
      return raw;
    }
  }

  async writeFile(filePath: string, data: Buffer | string, ...x: Array<any>): Promise<void> {
    filePath = path.normalize(filePath);
    const { id, type } = this._parsePath(filePath);
    const doc = JSON.parse(data.toString());

    if (id !== doc._id) {
      throw new Error(`Doc _id does not match file path ${doc._id} != ${id || 'null'}`);
    }

    if (type !== doc.type) {
      throw new Error(`Doc type does not match file path ${doc.type} != ${type || 'null'}`);
    }

    await db.upsert(doc, true);
  }

  async unlink(filePath: string, ...x: Array<any>): Promise<void> {
    filePath = path.normalize(filePath);
    const { id, type } = this._parsePath(filePath);

    if (!id || !type) {
      throw new Error(`Cannot unlink file ${filePath}`);
    }

    const doc = await db.get(type, id);

    if (!doc) {
      return;
    }

    await db.unsafeRemove(doc, true);
  }

  async readdir(filePath: string, ...x: Array<any>): Promise<Array<string>> {
    filePath = path.normalize(filePath);

    const MODELS = [
      models.workspace.type,
      models.environment.type,
      models.requestGroup.type,
      models.request.type,
      models.apiSpec.type,
    ];

    const { type, id } = this._parsePath(filePath);

    let docs = [];
    let otherFolders = [];
    if (id === null && type === null) {
      otherFolders = MODELS;
    } else if (type !== null && id === null) {
      const workspace = await db.get(models.workspace.type, this._workspaceId);
      const children = await db.withDescendants(workspace);
      docs = children.filter(d => d.type === type);
    } else {
      throw new Error(`file path is not a directory ${filePath}`);
    }

    const ids = docs.map(d => `${d._id}.json`);
    return [...ids, ...otherFolders].sort();
  }

  async mkdir(filePath: string, ...x: Array<any>) {
    throw new Error('NeDBPlugin is not writable');
  }

  async rmdir(filePath: string, ...x: Array<any>) {
    throw new Error('NeDBPlugin is not writable');
  }

  async stat(filePath: string, ...x: Array<any>): Promise<Stat> {
    filePath = path.normalize(filePath);

    let fileBuff: Buffer | string | null = null;
    let dir: Array<string> | null = null;
    try {
      fileBuff = await this.readFile(filePath);
    } catch (err) {}

    if (fileBuff === null) {
      try {
        dir = await this.readdir(filePath);
      } catch (err) {
        // Nothing
      }
    }

    if (!fileBuff && !dir) {
      throw new Error(`Not found ${filePath}`);
    }

    if (fileBuff) {
      const doc = JSON.parse(fileBuff.toString());
      return new Stat({
        type: 'file',
        mode: 0o777,
        size: fileBuff.length,
        ino: doc._id,
        mtimeMs: doc.modified,
      });
    } else {
      return new Stat({
        type: 'dir',
        mode: 0o777,
        size: 0,
        ino: 0,
        mtimeMs: 0,
      });
    }
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

  _parsePath(filePath: string): { type: string | null, id: string | null } {
    filePath = path.normalize(filePath);

    const [type, idRaw] = filePath.split(/\//g).filter(s => s !== '');

    const id = typeof idRaw === 'string' ? idRaw.replace(/\.json$/, '') : idRaw;

    return {
      type: type || null,
      id: id || null,
    };
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
