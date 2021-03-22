// @flow
import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';

type FSWraps =
  | fs.FSPromise.readFile
  | fs.FSPromise.writeFile
  | fs.FSPromise.unlink
  | fs.FSPromise.readdir
  | fs.FSPromise.mkdir
  | fs.FSPromise.rmdir
  | fs.FSPromise.stat
  | fs.FSPromise.lstat
  | fs.FSPromise.readlink
  | fs.FSPromise.symlink;

/** This is a plugin for isomorphic-git. {@link https://isomorphic-git.org/docs/en/fs} */
export const fsPlugin = (basePath: string) => {
  console.log(`[fsPlugin] Created in ${basePath}`);
  mkdirp.sync(basePath);

  const wrap = (fn: FSWraps) => async (filePath: string, ...args: Array<any>): Promise<T> => {
    const modifiedPath = path.join(basePath, path.normalize(filePath));
    return fn(modifiedPath, ...args);
  };

  return {
    promises: {
      /** this `enumerable` property is crucial, because it is the mechanism for telling isomorphic-git to exclusively use the promise API. {@link https://isomorphic-git.org/docs/en/fs#implementing-your-own-fs} */
      enumerable: true,
      readFile: wrap(fs.promises.readFile),
      writeFile: wrap(fs.promises.writeFile),
      unlink: wrap(fs.promises.unlink),
      readdir: wrap(fs.promises.readdir),
      mkdir: wrap(fs.promises.mkdir),
      rmdir: wrap(fs.promises.rmdir),
      stat: wrap(fs.promises.stat),
      lstat: wrap(fs.promises.lstat),
      readlink: wrap(fs.promises.readlink),
      symlink: wrap(fs.promises.symlink),
    },
  };
};
