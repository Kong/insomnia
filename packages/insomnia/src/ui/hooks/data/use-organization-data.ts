import type { QueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import type { BaseModel, GitRepository, Project, Workspace, WorkspaceMeta } from 'insomnia-data';
import { models } from 'insomnia-data';

export type ProjectWithGitRepository = Project & { gitRepository?: GitRepository };

export const organizationDataKeys = {
  all: ['organization-data'],
  byOrganizationId: (organizationId: string) => [...organizationDataKeys.all, organizationId],
};

export const workspaceMetaKeys = {
  all: ['workspace-meta'],
  byOrganizationId: (organizationId: string) => [...workspaceMetaKeys.all, organizationId],
};

export interface OrganizationData {
  projects: ProjectWithGitRepository[];
  workspaces: Workspace[];
  workspaceMetas: WorkspaceMeta[];
}

export const fetchOrganizationData = async (organizationId: string): Promise<OrganizationData> => {
  console.log(`Fetching organization data for organizationId: ${organizationId}`);
  const { projects, workspaces, workspaceMetas } = await window.main.getOrganizationData(organizationId);
  return {
    projects: models.project.sortProjects(projects),
    workspaces,
    workspaceMetas,
  };
};

export const useOrganizationData = (organizationId: string): OrganizationData => {
  const { data: organizationData } = useQuery({
    queryKey: organizationDataKeys.byOrganizationId(organizationId),
    queryFn: () => fetchOrganizationData(organizationId),
    initialData: { projects: [], workspaces: [], workspaceMetas: [] },
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

export const findOrgForWorkspaceId = (
  queryClient: QueryClient,
  workspaceId: string,
): string | undefined => {
  const cached = queryClient.getQueriesData<OrganizationData>({ queryKey: organizationDataKeys.all });
  for (const [queryKey, data] of cached) {
    if (data?.workspaces.some(w => w._id === workspaceId)) {
      return queryKey[1] as string;
    }
  }
  return undefined;
};

export const updateOrganizationDataWorkspaceMeta = (
  queryClient: QueryClient,
  organizationId: string,
  workspaceMeta: BaseModel,
) => {
  queryClient.setQueryData<OrganizationData>(organizationDataKeys.byOrganizationId(organizationId), previous => {
    if (previous) {
      const clonedWorkspaceMetas = [...previous.workspaceMetas];
      const workspaceMetaIdx = clonedWorkspaceMetas.findIndex(wm => wm._id === workspaceMeta._id);
      if (workspaceMetaIdx !== -1) {
        clonedWorkspaceMetas[workspaceMetaIdx] = workspaceMeta as WorkspaceMeta;
        return { ...previous, workspaceMetas: clonedWorkspaceMetas };
      }
    }
    return previous;
  });
};

export const deleteOrganizationDataWorkspaceMeta = (
  queryClient: QueryClient,
  organizationId: string,
  workspaceMeta: BaseModel,
) => {
  queryClient.setQueryData<OrganizationData>(organizationDataKeys.byOrganizationId(organizationId), previous => {
    if (previous) {
      const updatedWorkspaceMetas = previous.workspaceMetas.filter(wm => wm._id !== workspaceMeta._id);
      return { ...previous, workspaceMetas: updatedWorkspaceMetas };
    }
    return previous;
  });
};

export const addOrganizationDataWorkspaceMeta = (
  queryClient: QueryClient,
  organizationId: string,
  workspaceMeta: BaseModel,
) => {
  queryClient.setQueryData<OrganizationData>(organizationDataKeys.byOrganizationId(organizationId), previous => {
    if (previous) {
      const updatedWorkspaceMetas = [...previous.workspaceMetas, workspaceMeta as WorkspaceMeta];
      return { ...previous, workspaceMetas: updatedWorkspaceMetas };
    }
    return previous;
  });
};
