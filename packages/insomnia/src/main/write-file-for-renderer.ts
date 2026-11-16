import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface WriteFileForRendererOptions {
  path: string;
  content: string | Uint8Array;
  /**
   * POSIX permissions of the file, for content that only its owner should read (`0o600`). Without it the file gets the
   * default permissions of the system. It has no effect on Windows, where access follows the ACL of the folder.
   */
  mode?: number;
}

/**
 * Writes a file on behalf of the renderer, creating the folder when it is missing.
 *
 * With `mode`, the content goes to a temporary file in the same folder, created with that mode, which is then renamed over
 * the target. So the content is never in a file with wider permissions, not even briefly; an existing target keeps its
 * old content when the write fails, and is replaced as a whole when it succeeds; and the target gets a file of its own, a
 * symbolic link or a hard link to it is not written through. No `chmod` is needed, which can fail on file systems that
 * do not support permissions (a FAT or exFAT drive, a network share).
 */
export const writeFileForRenderer = async ({ path: filePath, content, mode }: WriteFileForRendererOptions) => {
  if (mode !== undefined && !(Number.isInteger(mode) && mode >= 0 && mode <= 0o777)) {
    throw new Error('The file mode must be an integer between 0 and 0o777');
  }
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  // On Windows a mode means nothing, so there is no reason to give up the plain write
  if (mode === undefined || process.platform === 'win32') {
    await fs.promises.writeFile(filePath, content);
    return filePath;
  }
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    const file = await fs.promises.open(tempPath, 'wx', mode);
    try {
      await file.writeFile(content);
    } finally {
      await file.close();
    }
    await fs.promises.rename(tempPath, filePath);
  } catch (error) {
    await fs.promises.rm(tempPath, { force: true });
    throw error;
  }
  return filePath;
};
