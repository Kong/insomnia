// @flow
import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';

export default class FSPlugin {
  _basePath: string;

  constructor(basePath?: string = '/') {
    mkdirp.sync(basePath);
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
