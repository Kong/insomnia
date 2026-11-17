import fs from 'node:fs';
import path from 'node:path';

import { isPathInsideDir } from '../../main/ipc/path-guard';

const escapeError = (filePath: string) =>
  Object.assign(new Error(`Path escapes the git working directory: ${filePath}`), { code: 'EACCES' });

/**
 * Resolves a path handed to the isomorphic-git fs client against `basePath`,
 * throwing if it would land outside it. isomorphic-git builds paths from git
 * tree entry names without validating them, so `..` segments can arrive here.
 * Lexical only; see {@link assertRealPathContained} for symlinks.
 */
export const resolveContainedPath = (basePath: string, filePath: string): string => {
  const resolved = path.join(basePath, path.normalize(filePath));
  if (!isPathInsideDir(resolved, basePath)) {
    throw escapeError(filePath);
  }
  return resolved;
};

const MAX_LINK_HOPS = 40;

/** realpath() that tolerates a non-existent tail: resolves the deepest existing ancestor and re-appends the rest. Dangling symlinks are followed, as a write through them would create their target. */
const realpathOfDeepestExisting = async (p: string, hops = 0): Promise<string> => {
  if (hops > MAX_LINK_HOPS) {
    throw Object.assign(new Error('Too many symbolic links'), { code: 'ELOOP' });
  }
  try {
    return await fs.promises.realpath(p);
  } catch (err: any) {
    if (err?.code !== 'ENOENT' && err?.code !== 'ENOTDIR') {
      throw err;
    }
  }
  try {
    const stat = await fs.promises.lstat(p);
    if (stat.isSymbolicLink()) {
      const target = await fs.promises.readlink(p);
      return realpathOfDeepestExisting(path.resolve(path.dirname(p), target), hops + 1);
    }
  } catch {
    // does not exist at all, fall through to the parent
  }
  const parent = path.dirname(p);
  if (parent === p) {
    return p;
  }
  return path.join(await realpathOfDeepestExisting(parent, hops), path.basename(p));
};

/**
 * Ensures `resolvedPath` (already lexically contained) does not reach outside `basePath` through
 * symlinks. With `followLeaf` false the final component is not followed (lstat/readlink/unlink/the
 * location of a link being created), only its ancestors are.
 */
export const assertRealPathContained = async (basePath: string, resolvedPath: string, followLeaf: boolean) => {
  const realBase = await fs.promises.realpath(basePath);
  const candidate = followLeaf || resolvedPath === path.resolve(basePath) ? resolvedPath : path.dirname(resolvedPath);
  const realCandidate = await realpathOfDeepestExisting(candidate);
  if (!isPathInsideDir(realCandidate, realBase)) {
    throw escapeError(resolvedPath);
  }
};
