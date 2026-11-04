import type { GitRepository } from 'insomnia-data';
import { models, services } from 'insomnia-data';

/*
 * Removes a git repo from the database and unlinks it from associated projects and workspaces.
 *
 * Clearing only the credentials from the git repo would leave the associated workspace in a broken
 * state where the user would need to manually reset the git repo settings, and that is not
 * immediately apparent in the UI.
 *
 * This way, the user can simply re-connect with their settings.
 *
 * Almost identical to resetGitRepoAction in main/git-service.ts, but walks through
 * each model instance individually to clear them all out.
 *
 */

export async function removeGitRepository(repo: GitRepository) {
  const projects = await services.project.listByGitRepositoryIds(repo._id);
  for (const p of projects) {
    await services.project.update(p, { gitRepositoryId: models.project.EMPTY_GIT_PROJECT_ID });
  }

  const workspaceMetas = await services.workspaceMeta.list({ gitRepositoryId: repo._id });
  for (const wsMeta of workspaceMetas) {
    await services.workspaceMeta.update(wsMeta, { gitRepositoryId: null });
  }
  await services.gitRepository.remove(repo);
}
