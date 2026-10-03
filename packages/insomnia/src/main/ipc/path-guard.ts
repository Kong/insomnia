import path from 'node:path';

// Lexical containment check (does not resolve symlinks). A candidate equal to `dir` itself is treated as inside.
// sync/git fs-client containment removed: superseded by #10560 (symlink-aware safe-fs-write),
// which also covers backup restore.
export const isPathInsideDir = (candidatePath: string, dir: string): boolean => {
  const resolved = path.resolve(dir, candidatePath);
  return (resolved + path.sep).startsWith(path.resolve(dir) + path.sep);
};

// Resolves a renderer-supplied folder under userData, throwing if it escapes it.
export const resolveUserDataFolder = (userDataDir: string, folder: string): string => {
  if (!isPathInsideDir(folder, userDataDir)) {
    throw new Error('readOrCreateDataDir: folder is outside the allowed userData directory');
  }
  return path.resolve(userDataDir, folder);
};
