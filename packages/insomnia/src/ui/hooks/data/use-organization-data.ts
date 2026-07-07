import type { QueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import type { BaseModel, GitRepository, Project, Workspace } from 'insomnia-data';
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
  console.log(`Fetching organization data for organizationId: ${organizationId}`);
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

export const findOrgAndProjectForWorkspace = (
  queryClient: QueryClient,
  doc: BaseModel,
): { organizationId: string; projectId: string } | undefined => {
  const cached = queryClient.getQueriesData<OrganizationData>({ queryKey: organizationDataKeys.all });
  const { parentId } = doc;
  for (const [queryKey, data] of cached) {
    const project = data?.projects.find(p => p._id === parentId);
    if (project) {
      return { organizationId: queryKey[1] as string, projectId: project._id };
    }
  }
  return undefined;
};
