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

/**
 * Joins `relPath` onto `basePath` and asserts the result cannot escape
 * `basePath` — guards against a git tree entry's relative symlink target,
 * or a `../`-laden file path, resolving outside the repository's working
 * directory.
 */
const resolveWithinBase = (basePath: string, relPath: string): string => {
  const resolvedPath = path.join(basePath, path.normalize(relPath));
  const relative = path.relative(basePath, resolvedPath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`[fsClient] Refusing to access path outside repository working directory: ${relPath}`);
  }

  return resolvedPath;
};

/**
 * `isomorphic-git`'s checkout write phase catches each file/symlink write
 * error itself and never rethrows, so the caller has no other way to learn
 * a write was refused. Called right before throwing.
 */
export type BlockedWriteHandler = (relPath: string, message: string) => void;

export interface BlockedWrite {
  relPath: string;
  message: string;
}

/** This is a client for isomorphic-git. {@link https://isomorphic-git.org/docs/en/fs} */
export const fsClient = (basePath: string, onBlockedWrite?: BlockedWriteHandler) => {
  console.log(`[fsClient] Created in ${basePath}`);
  fs.mkdirSync(basePath, { recursive: true });

  const resolveOrReport = (relPath: string): string => {
    try {
      return resolveWithinBase(basePath, relPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      onBlockedWrite?.(relPath, message);
      throw err;
    }
  };

  const wrap =
    (fn: FSWraps) =>
    async (filePath: string, ...args: any[]) => {
      const modifiedPath = resolveOrReport(filePath);

      // @ts-expect-error -- TSCONVERSION
      return fn(modifiedPath, ...args);
    };

  const wrapSymlink =
    (fn: typeof fs.promises.symlink) =>
    async (filePath: string, target: string, ...args: any[]) => {
      const modifiedPath = resolveOrReport(filePath);
      // The symlink target must also resolve within the git working directory.
      const modifiedTarget = resolveOrReport(target);

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
