const GIT_DIR_NAME = '.git';

/**
 * Checks that a folder path (relative to the repository root) stays inside the repository
 * and does not point into the `.git` directory.
 */
export function isSafeRepoFolderPath(folderPath: string | undefined | null): boolean {
  if (!folderPath) {
    return true;
  }

  if (folderPath.startsWith('/') || folderPath.startsWith('\\') || /^[a-zA-Z]:/.test(folderPath)) {
    return false;
  }

  return folderPath.split(/[\\/]/).every(segment => {
    // On Windows, `:` addresses an NTFS alternate data stream (e.g. `.git::$INDEX_ALLOCATION` resolves to `.git`),
    // but it is a legal character on macOS/Linux, so only compare the part before the stream suffix.
    const name = segment.split(':')[0];
    if (name === '..') {
      return false;
    }

    // Windows ignores trailing dots and spaces in path segments, so `.git.` or `.git ` resolve to `.git`.
    return name.replace(/[. ]+$/, '').toLowerCase() !== GIT_DIR_NAME;
  });
}
