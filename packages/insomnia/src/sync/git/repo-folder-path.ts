import { isWindows } from 'insomnia-data/common';

const GIT_DIR_NAME = '.git';

/**
 * Checks that a folder path (relative to the repository root) stays inside the repository
 * and does not point into the `.git` directory.
 */
export function isSafeRepoFolderPath(folderPath: string | undefined | null): boolean {
  if (!folderPath) {
    return true;
  }

  if (folderPath.startsWith('/') || folderPath.startsWith('\\')) {
    return false;
  }

  // A `<letter>:` prefix is a drive reference only on Windows; elsewhere `v: specs` is a legal folder name.
  if (isWindows && /^[a-zA-Z]:/.test(folderPath)) {
    return false;
  }

  return folderPath.split(/[\\/]/).every(segment => {
    // On Windows, `:` addresses an NTFS alternate data stream (e.g. `.git::$INDEX_ALLOCATION` resolves to `.git`),
    // but it is a legal character on macOS/Linux, so only compare the part before the stream suffix.
    const name = segment.split(':')[0];
    // Windows ignores trailing dots and spaces in path segments, so `.git.` or `.git ` resolve to `.git`,
    // and a segment made only of dots and spaces (e.g. `.. ` or `.. .`) can resolve to `..`.
    const windowsName = name.replace(/[. ]+$/, '');
    if (name === '..' || (windowsName === '' && name !== '')) {
      return false;
    }

    return windowsName.toLowerCase() !== GIT_DIR_NAME;
  });
}
