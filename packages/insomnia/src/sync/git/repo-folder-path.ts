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

  return folderPath.split(/[\\/]/).every(segment => segment !== '..' && segment.toLowerCase() !== GIT_DIR_NAME);
}
