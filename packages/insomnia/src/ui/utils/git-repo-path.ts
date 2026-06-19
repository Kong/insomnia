import type { GitRepository } from 'insomnia-data';

/**
 * Resolve a Git repository's on-disk base directory in the renderer.
 *
 * Mirrors the main-process `getRepoBaseDir` (git-service.ts): a user-chosen
 * `directory` when set, else the app-managed location. See GIT_LOCAL_REPOS_DESIGN.md.
 */
export const resolveGitRepoBaseDir = (gitRepository: Pick<GitRepository, '_id' | 'directory'>): string => {
  if (gitRepository.directory) {
    return gitRepository.directory;
  }
  return window.path.join(window.app.getPath('userData'), `version-control/git/${gitRepository._id}`);
};
