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
  // wrong type — so only these three get the extra guard.
  //
  // A leaf symlink is only refused when it is unsafe: the fully resolved
  // target (`realpath`, so chains are followed to the end) must stay inside
  // the *real* path of `basePath` (basePath itself may sit under a symlink,
  // e.g. macOS /var -> /private/var). Links that fail to resolve (broken,
  // loops) are refused, since the OS would create/follow whatever they name.
  // In-repo links are legitimate git content (mode 120000) and are allowed
  // without calling `onBlockedWrite`. For `write`, a link that resolves into
  // the repo's `.git` directory is also refused: git-sync's own `.git`
  // access always uses direct paths, so a link into it can only be an
  // attempt to plant hooks/config.
  //
  // The `lstat`/`realpath`-then-`open`/`read`/`stat` here has a narrow TOCTOU
  // window (the link can be swapped between the check and the call), same
  // class already accepted by `writeFileWithinDir`'s Windows fallback in
  // safe-fs-write.ts.
  const isOutside = (relative: string) =>
    relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);

  const isSafeSymlinkTarget = async (linkPath: string, verb: string): Promise<boolean> => {
    let realTarget: string;
    let realBase: string;
    try {
      realTarget = await fs.promises.realpath(linkPath);
      realBase = await fs.promises.realpath(basePath);
    } catch {
      return false;
    }
    const relative = path.relative(realBase, realTarget);
    if (isOutside(relative)) {
      return false;
    }
    if (verb === 'write') {
      const gitRelative = path.relative(path.join(realBase, '.git'), realTarget);
      if (!isOutside(gitRelative)) {
        return false;
      }
    }
    return true;
  };

  // True when a write whose own path is NOT under `.git` reaches it through
  // an in-repo symlinked directory (e.g. `hooks-link -> .git/hooks`).
  const intoGitViaLink = async (absPath: string): Promise<boolean> => {
    const realBase = await fs.promises.realpath(basePath).catch(() => null);
    const realDir = await fs.promises.realpath(path.dirname(absPath)).catch(() => null);
    if (!realBase || !realDir) {
      return false;
    }
    const gitDir = path.join(realBase, '.git');
    const lexicalDir = path.join(realBase, path.relative(path.resolve(basePath), path.dirname(absPath)));
    return !isOutside(path.relative(gitDir, realDir)) && isOutside(path.relative(gitDir, lexicalDir));
  };

  const wrapFollowsLeaf =
    (fn: FSWraps, verb: string) =>
    async (filePath: string, ...args: any[]) => {
      const modifiedPath = await resolveOrReport(filePath);

      const leaf = await fs.promises.lstat(modifiedPath).catch(() => null);
      const unsafeLeaf = leaf?.isSymbolicLink() && !(await isSafeSymlinkTarget(modifiedPath, verb));
      if (unsafeLeaf || (verb === 'write' && (await intoGitViaLink(modifiedPath)))) {
        const message = `[fsClient] Refusing to ${verb} through a symlink that resolves outside the repository: ${filePath}`;
        onBlockedWrite?.(filePath, message);
        throw new Error(message);
      }

      // @ts-expect-error -- TSCONVERSION
      return fn(modifiedPath, ...args);
    };

  // isomorphic-git calls `symlink(target, filepath)`. The target is the stored link text and is kept
  // verbatim, but both the link's location and where it points must stay inside basePath.
  const wrapSymlink =
    (fn: typeof fs.promises.symlink) =>
    async (target: string, filePath: string, ...args: any[]) => {
      const linkPath = await resolveOrReport(filePath);
      // The link must also point inside the git working directory (a relative target is interpreted
      // against the link's own directory). The stored link text itself is passed through unchanged.
      const resolvedTarget = path.resolve(path.dirname(linkPath), target);
      await resolveOrReport(path.relative(basePath, resolvedTarget));

      return fn(target, linkPath, ...args);
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
