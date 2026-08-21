import type { GitRepository, OrganizationData } from 'insomnia-data';
import { database, models } from 'insomnia-data';

import * as projectService from '../project';
import * as workspaceService from '../workspace';
import * as workspaceMetaService from '../workspace-meta';

const isNotNullOrUndefined = <ValueType>(value: ValueType | null | undefined): value is ValueType => {
  if (value === null || value === undefined) {
    return false;
  }

  return true;
};

/**
 * Get organization data by ID.
 */
export async function getOrganizationData(organizationId: string): Promise<OrganizationData> {
  const projects = await projectService.listByOrganizationIds(organizationId);
  const projectIds = projects.map(p => p._id);
  const gitRepositoryIds = projects
    .map(p => (models.project.isConnectedGitProject(p) ? models.project.getEffectiveRepoId(p) : null))
    .filter(isNotNullOrUndefined);

  const [gitRepositories, workspaces] = await Promise.all([
    database.find<GitRepository>(models.gitRepository.type, {
      _id: { $in: gitRepositoryIds },
    }),
    workspaceService.list({ parentId: { $in: projectIds } }),
  ]);
  const workspaceMetas = await workspaceMetaService.list({ parentId: { $in: workspaces.map(w => w._id) } });

  const projectsWithGitRepos = models.project.sortProjects(projects).map(project => {
    const effectiveId = models.project.isConnectedGitProject(project)
      ? models.project.getEffectiveRepoId(project)
      : null;
    return {
      ...project,
      gitRepository: gitRepositories.find((gr): gr is GitRepository => gr != null && gr._id === effectiveId),
    };
  });

  return { projects: projectsWithGitRepos, workspaces, workspaceMetas };
}
