import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { GitRepository, Project } from 'insomnia-data';
import { models } from 'insomnia-data';

import { getProjectsWithGitRepositories } from '~/common/project';

export type ProjectWithGitRepository = Project & { gitRepository?: GitRepository };

export const projectKeys = {
  all: ['projects'],
  details: (organizationId: string) => [...projectKeys.all, organizationId],
  detail: (projectId: string, organizationId: string) => [...projectKeys.details(organizationId), projectId],
};

export const getProjects = async (organizationId: string): Promise<ProjectWithGitRepository[]> =>
  models.project.sortProjects(await getProjectsWithGitRepositories({ organizationId }));

export const useProjects = (organizationId: string): UseQueryResult<ProjectWithGitRepository[]> => {
  return useQuery({
    queryKey: projectKeys.details(organizationId),
    queryFn: () => getProjects(organizationId),
  });
};
