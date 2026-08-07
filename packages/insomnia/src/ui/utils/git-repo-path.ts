import { type GitRepository, models } from 'insomnia-data';

/**
 * Resolve a Git repository's on-disk base directory in the renderer.
 *
 * Mirrors the main-process `getRepoBaseDir` (git-service.ts): a user-chosen
 * `directory` when set, else the app-managed location (named via
 * `models.gitRepository.getGitRepoFolderName`).
 */
export const resolveGitRepoBaseDir = (gitRepository: Pick<GitRepository, '_id' | 'directory' | 'folderSlug'>): string => {
  if (gitRepository.directory) {
    return gitRepository.directory;
  }
  const folderName = models.gitRepository.getGitRepoFolderName(gitRepository);
  return window.path.join(window.app.getPath('userData'), `version-control/git/${folderName}`);
};
