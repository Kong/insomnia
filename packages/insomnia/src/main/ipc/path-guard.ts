import path from 'node:path';

export const isPathInsideDir = (candidatePath: string, dir: string): boolean => {
  const resolved = path.resolve(dir, candidatePath);
  return (resolved + path.sep).startsWith(path.resolve(dir) + path.sep);
};
