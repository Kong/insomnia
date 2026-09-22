import fs from 'node:fs';
import path from 'node:path';

/**
 * Resolves symlinks in whichever ancestor directory chain of `targetPath`
 * actually exists yet, walking up until it finds one. `targetPath` itself
 * (and any of its non-existent ancestors) may not exist — that's expected
 * when the caller is about to create it.
 */
async function realpathOfDeepestExistingAncestor(targetPath: string): Promise<string> {
  let dir = path.resolve(targetPath);
  while (true) {
    try {
      return await fs.promises.realpath(dir);
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) {
        // Reached the filesystem root without finding anything real.
        return dir;
      }
      dir = parent;
    }
  }
}

/**
 * Asserts that `targetPath` resolves inside `baseDir`. Throws if it doesn't.
 *
 * Used to enforce that writes the app performs on behalf of a project,
 * workspace, or git-synced repo can never land outside that project's own
 * directory — even if the path was built from data that came from outside
 * Insomnia's control (a git commit, an imported file, a plugin manifest,
 * etc).
 *
 * Checks two things:
 *  1. Lexically, the resolved path string doesn't `..` out of `baseDir`.
 *  2. Any *existing* ancestor directory, once symlinks are resolved via
 *     `realpath`, still lands inside `baseDir`'s real path — this catches a
 *     symlinked intermediate directory (not just the final path component)
 *     being used to escape `baseDir`.
 *
 * Note: there's an inherent TOCTOU window between this check and whatever
 * the caller does next (e.g. `mkdir`/`open`) — a real directory could be
 * swapped for a symlink in between. Combine this with `writeFileWithinDir`
 * (which additionally opens the final component with `O_NOFOLLOW`) rather
 * than relying on this check alone.
 */
export async function assertPathWithinDir(baseDir: string, targetPath: string): Promise<void> {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  const lexicalRelative = path.relative(resolvedBase, resolvedTarget);

  if (lexicalRelative.startsWith('..') || path.isAbsolute(lexicalRelative)) {
    throw new Error(`Refusing to write outside of directory "${resolvedBase}": ${targetPath}`);
  }

  const realBase = await fs.promises.realpath(resolvedBase).catch(() => resolvedBase);
  const realAncestor = await realpathOfDeepestExistingAncestor(path.dirname(resolvedTarget));
  const realRelative = path.relative(realBase, realAncestor);

  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    throw new Error(`Refusing to write through a symlinked directory outside of "${realBase}": ${targetPath}`);
  }
}

// O_NOFOLLOW is POSIX-only; Node exposes it as undefined on Windows, where
// creating a symlink already requires elevated privileges, so this specific
// risk is much lower there. Fall back to plain flags rather than failing
// outright.
const NO_FOLLOW_WRITE_FLAGS =
  fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | (fs.constants.O_NOFOLLOW ?? 0);

/**
 * Writes `content` to `absPath`, refusing to follow a symlink at that
 * location — or through any symlinked intermediate directory — and
 * refusing to write outside of `baseDir`.
 *
 * The final-component symlink guard uses `O_NOFOLLOW` at `open()` time
 * (rather than an `lstat` check beforehand) so there's no TOCTOU window for
 * that specific check — if `absPath`'s final component is a symlink, the
 * `open()` call itself fails with `ELOOP`.
 */
export async function writeFileWithinDir(
  baseDir: string,
  absPath: string,
  content: string,
  encoding: BufferEncoding = 'utf8',
): Promise<void> {
  await assertPathWithinDir(baseDir, absPath);

  const handle = await fs.promises.open(absPath, NO_FOLLOW_WRITE_FLAGS, 0o644).catch((err: unknown) => {
    if (err instanceof Error && 'code' in err && err.code === 'ELOOP') {
      throw new Error(`Refusing to write through symlink: ${absPath}`);
    }
    throw err;
  });

  try {
    await handle.writeFile(content, encoding);
  } finally {
    await handle.close();
  }
}
