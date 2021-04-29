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

/** This is a client for isomorphic-git. {@link https://isomorphic-git.org/docs/en/fs} */
export const fsClient = (basePath: string) => {
  console.log(`[fsClient] Created in ${basePath}`);
  mkdirp.sync(basePath);

  const wrap = (fn: FSWraps) => async (filePath: string, ...args: Array<any>): Promise<T> => {
    const modifiedPath = path.join(basePath, path.normalize(filePath));
    return fn(modifiedPath, ...args);
  };

  return {
    promises: {
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
