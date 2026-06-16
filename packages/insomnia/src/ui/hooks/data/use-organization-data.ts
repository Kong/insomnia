import type { QueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import type { GitRepository, Project, Workspace } from 'insomnia-data';
import { models } from 'insomnia-data';

export type ProjectWithGitRepository = Project & { gitRepository?: GitRepository };

export const organizationDataKeys = {
  all: ['organization-data'],
  byOrganizationId: (organizationId: string) => [...organizationDataKeys.all, organizationId],
};

export interface OrganizationData {
  projects: ProjectWithGitRepository[];
  workspaces: Workspace[];
}

export const fetchOrganizationData = async (organizationId: string): Promise<OrganizationData> => {
  const { projects, workspaces } = await window.main.getOrganizationData(organizationId);
  return {
    projects: models.project.sortProjects(projects),
    workspaces,
  };
};

export const useOrganizationData = (organizationId: string): OrganizationData => {
  const { data: organizationData } = useQuery({
    queryKey: organizationDataKeys.byOrganizationId(organizationId),
    queryFn: () => fetchOrganizationData(organizationId),
    initialData: { projects: [], workspaces: [] },
  });
  return organizationData;
};

export const findOrganizationIdForProject = (queryClient: QueryClient, projectId: string): string | undefined => {
  const cached = queryClient.getQueriesData<OrganizationData>({ queryKey: organizationDataKeys.all });
  for (const [queryKey, data] of cached) {
    if (data?.projects.some(p => p._id === projectId)) {
      return queryKey[1] as string;
    }
  }
  return undefined;
};

export const findOrgAndProjectForWorkspace = (
  queryClient: QueryClient,
  workspaceId: string,
): { organizationId: string; projectId: string } | undefined => {
  const cached = queryClient.getQueriesData<OrganizationData>({ queryKey: organizationDataKeys.all });
  for (const [queryKey, data] of cached) {
    if (data?.workspaces.some(w => w._id === workspaceId)) {
      const workspace = data.workspaces.find(w => w._id === workspaceId);
      const project = data.projects.find(p => p._id === workspace?.parentId);
      if (workspace && project) {
        return { organizationId: queryKey[1] as string, projectId: project._id };
      }
    }
  }
  return undefined;
};
