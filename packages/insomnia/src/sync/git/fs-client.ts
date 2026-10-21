import fs from 'node:fs';

import { assertRealPathContained, resolveContainedPath } from './contained-path';

type FSWraps =
  | typeof fs.promises.readFile
  | typeof fs.promises.writeFile
  | typeof fs.promises.unlink
  | typeof fs.promises.readdir
  | typeof fs.promises.mkdir
  | typeof fs.promises.rmdir
  | typeof fs.promises.stat
  | typeof fs.promises.lstat
  | typeof fs.promises.readlink
  | typeof fs.promises.symlink;

/** This is a client for isomorphic-git. {@link https://isomorphic-git.org/docs/en/fs} */
export const fsClient = (basePath: string) => {
  console.log(`[fsClient] Created in ${basePath}`);
  fs.mkdirSync(basePath, { recursive: true });

  // `followLeaf: false` is for operations that act on a symlink itself rather than what it points to.
  const wrap =
    (fn: FSWraps, followLeaf = true) =>
    async (filePath: string, ...args: any[]) => {
      const modifiedPath = resolveContainedPath(basePath, filePath);
      await assertRealPathContained(basePath, modifiedPath, followLeaf);

      // @ts-expect-error -- TSCONVERSION
      return fn(modifiedPath, ...args);
    };

  // isomorphic-git calls `symlink(target, filepath)`. The target is the stored link text and must be
  // kept verbatim (it may legitimately be relative or point outside the repo); only the location of
  // the link is confined. Writes through a link that resolves outside basePath are refused by `wrap`.
  const wrapSymlink =
    (fn: typeof fs.promises.symlink) =>
    async (target: string, filePath: string, ...args: any[]) => {
      const linkPath = resolveContainedPath(basePath, filePath);
      await assertRealPathContained(basePath, linkPath, false);

      return fn(target, linkPath, ...args);
    };

  return {
    promises: {
      readFile: wrap(fs.promises.readFile),
      writeFile: wrap(fs.promises.writeFile),
      unlink: wrap(fs.promises.unlink, false),
      readdir: wrap(fs.promises.readdir),
      mkdir: wrap(fs.promises.mkdir),
      rmdir: wrap(fs.promises.rmdir, false),
      stat: wrap(fs.promises.stat),
      lstat: wrap(fs.promises.lstat, false),
      readlink: wrap(fs.promises.readlink, false),
      symlink: wrapSymlink(fs.promises.symlink),
    },
  };
};
