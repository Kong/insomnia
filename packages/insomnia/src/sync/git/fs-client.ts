import fs from 'node:fs';
import path from 'node:path';

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

// path.normalize() leaves a leading ".." untouched, so a bare ".." path must be rejected
// explicitly to keep every resolved path inside basePath.
const resolveWithinBase = (basePath: string, relativePath: string): string => {
  const resolved = path.join(basePath, path.normalize(relativePath));
  const relative = path.relative(basePath, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`fsClient: path "${relativePath}" escapes the repository directory`);
  }
  return resolved;
};

/** This is a client for isomorphic-git. {@link https://isomorphic-git.org/docs/en/fs} */
export const fsClient = (basePath: string) => {
  console.log(`[fsClient] Created in ${basePath}`);
  fs.mkdirSync(basePath, { recursive: true });

  const wrap =
    (fn: FSWraps) =>
    async (filePath: string, ...args: any[]) => {
      const modifiedPath = resolveWithinBase(basePath, filePath);

      // @ts-expect-error -- TSCONVERSION
      return fn(modifiedPath, ...args);
    };

  const wrapSymlink =
    (fn: typeof fs.promises.symlink) =>
    async (filePath: string, target: string, ...args: any[]) => {
      const modifiedPath = resolveWithinBase(basePath, filePath);
      const modifiedTarget = resolveWithinBase(basePath, target);

      return fn(modifiedPath, modifiedTarget, ...args);
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
      symlink: wrapSymlink(fs.promises.symlink),
    },
  };
};
