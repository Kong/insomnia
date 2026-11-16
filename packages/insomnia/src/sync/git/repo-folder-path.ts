import { isWindows } from 'insomnia-data/common';

const GIT_DIR_NAME = '.git';

// Characters that are invalid in a file/folder name on at least one supported platform (Windows is the strictest).
// eslint-disable-next-line no-control-regex
const INVALID_FOLDER_NAME_CHARACTERS = /[\\/:*?"<>|\u0000-\u001F]/;

/**
 * Validates a single folder name that will be created inside a git repository.
 * Returns an error message, or null when the name is valid.
 */
export function validateRepoFolderName(name: string, siblingNames: string[] = []): string | null {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return 'Folder name is required';
  }

  if (name.includes('/') || name.includes('\\')) {
    return 'Folder name cannot contain path separators';
  }

  if (trimmedName === '.' || trimmedName === '..') {
    return 'Folder name is not allowed';
  }

  if (trimmedName.toLowerCase() === GIT_DIR_NAME) {
    return 'Folder name ".git" is reserved';
  }

  if (INVALID_FOLDER_NAME_CHARACTERS.test(name)) {
    return 'Folder name cannot contain any of the following characters: \\ / : * ? " < > |';
  }

  if (name !== trimmedName || name.endsWith('.')) {
    return 'Folder name cannot start or end with a space, or end with a period';
  }

  const lowerCaseName = name.toLowerCase();
  if (siblingNames.some(sibling => sibling.toLowerCase() === lowerCaseName)) {
    return 'A file or folder with the same name already exists';
  }

  return null;
}

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
