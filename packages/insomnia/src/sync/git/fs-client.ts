import fs from 'node:fs';
import path from 'node:path';

import { assertPathWithinDir } from '../../main/safe-fs-write';

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

  // isomorphic-git calls this client's methods per-file, potentially
  // thousands of times per checkout/status/diff. `assertPathWithinDir`'s
  // ancestor-realpath walk isn't free, so once a directory has been proven
  // to resolve inside `basePath` for *this* fsClient instance, later calls
  // for other files in that same directory skip the walk. This only caches
  // the already-validated fact for this short-lived instance — it never
  // persists across instances, so a directory swapped for a symlink after
  // this instance is done is re-checked fresh next time.
  const validatedDirs = new Set<string>();

  /**
   * Joins `relPath` onto `basePath` and asserts the result cannot escape
   * `basePath` — guards against a git tree entry's relative symlink target,
   * a `../`-laden file path, or a pre-existing symlinked ancestor directory,
   * resolving outside the repository's working directory.
   */
  const resolveWithinBase = async (relPath: string): Promise<string> => {
    const resolvedPath = path.join(basePath, path.normalize(relPath));
    const relative = path.relative(basePath, resolvedPath);

    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`[fsClient] Refusing to access path outside repository working directory: ${relPath}`);
    }

    const dir = path.dirname(resolvedPath);
    if (!validatedDirs.has(dir)) {
      try {
        await assertPathWithinDir(basePath, resolvedPath);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(`[fsClient] Refusing to access path outside repository working directory: ${relPath} (${detail})`);
      }
      validatedDirs.add(dir);
    }

    return resolvedPath;
  };

  const resolveOrReport = async (relPath: string): Promise<string> => {
    try {
      return await resolveWithinBase(relPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      onBlockedWrite?.(relPath, message);
      throw err;
    }
  };

  const wrap =
    (fn: FSWraps) =>
    async (filePath: string, ...args: any[]) => {
      const modifiedPath = await resolveOrReport(filePath);

      // @ts-expect-error -- TSCONVERSION
      return fn(modifiedPath, ...args);
    };

  // writeFile, readFile, and stat are the wrapped ops where a pre-existing
  // symlink at the leaf itself (not just an ancestor directory) matters:
  // `fs.promises.writeFile`/`readFile`/`stat` all follow it at the OS level.
  // `writeFile` would silently write attacker-controlled blob content to
  // whatever it points at; `readFile`/`stat` would silently read through /
  // stat through it, leaking the contents, existence, size, or mtime of a
  // file outside `basePath`. The other wrapped ops don't have this exposure
  // the same way — `unlink` removes the link itself rather than following
  // it, `lstat`/`readlink` intentionally inspect the link itself, and
  // `mkdir`/`rmdir`/`symlink` fail outright against an existing leaf of the
  // wrong type — so only these three get the extra guard. The
  // `lstat`-then-`open`/`read`/`stat` here has a narrow TOCTOU window, same
  // class already accepted by `writeFileWithinDir`'s Windows fallback in
  // safe-fs-write.ts.
  const wrapFollowsLeaf =
    (fn: FSWraps, verb: string) =>
    async (filePath: string, ...args: any[]) => {
      const modifiedPath = await resolveOrReport(filePath);

      const leaf = await fs.promises.lstat(modifiedPath).catch(() => null);
      if (leaf?.isSymbolicLink()) {
        const message = `[fsClient] Refusing to ${verb} through a pre-existing symlink: ${filePath}`;
        onBlockedWrite?.(filePath, message);
        throw new Error(message);
      }

      // @ts-expect-error -- TSCONVERSION
      return fn(modifiedPath, ...args);
    };

  const wrapSymlink =
    (fn: typeof fs.promises.symlink) =>
    async (filePath: string, target: string, ...args: any[]) => {
      const modifiedPath = await resolveOrReport(filePath);
      // The symlink target must also resolve within the git working directory.
      const modifiedTarget = await resolveOrReport(target);

      return fn(modifiedPath, modifiedTarget, ...args);
    };

  return {
    promises: {
      readFile: wrapFollowsLeaf(fs.promises.readFile, 'read'),
      writeFile: wrapFollowsLeaf(fs.promises.writeFile, 'write'),
      unlink: wrap(fs.promises.unlink),
      readdir: wrap(fs.promises.readdir),
      mkdir: wrap(fs.promises.mkdir),
      rmdir: wrap(fs.promises.rmdir),
      stat: wrapFollowsLeaf(fs.promises.stat, 'stat'),
      lstat: wrap(fs.promises.lstat),
      readlink: wrap(fs.promises.readlink),
      symlink: wrapSymlink(fs.promises.symlink),
    },
  };
};
