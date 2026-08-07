import { useMemo } from 'react';

import { useMultipleCollectionWorkspaceChildrenData, useOrganizationData } from '~/ui/hooks/use-insomnia-app-data';

interface UseProjectNavigationSidebarDataOptions {
  isProjectTabActive: boolean;
  projectNavigationSidebarFilter?: string;
  expandedProjectAndWorkspaceIds?: string[];
}

export function useProjectNavigationSidebarData(
  organizationId: string,
  options: UseProjectNavigationSidebarDataOptions,
) {
  const { isProjectTabActive, projectNavigationSidebarFilter, expandedProjectAndWorkspaceIds } = options;
  const { projects, workspaces, workspaceMetas } = useOrganizationData(organizationId);
  // Show konnect or none-konnect projects based on selected tab
  const activeProjects = useMemo(
    () => projects.filter(isProjectTabActive ? p => !p.konnectControlPlaneId : p => p.konnectControlPlaneId != null),
    [projects, isProjectTabActive],
  );
  const projectIds = useMemo(() => activeProjects.map(p => p._id), [activeProjects]);
  // Get the list of collection workspace ids that should be cached based on the current filter and expanded projects/workspaces.

  const collectionWorkspaceIds = useMemo(() => {
    const ids: string[] = [];
    projectIds.forEach(projectId => {
      workspaces
        .filter(w => w.parentId === projectId)
        .forEach(workspace => {
          if (
            workspace.scope === 'collection' &&
            (!!projectNavigationSidebarFilter || (expandedProjectAndWorkspaceIds || []).includes(workspace._id))
          ) {
            ids.push(workspace._id);
          }
        });
    });
    return ids;
  }, [projectIds, workspaces, projectNavigationSidebarFilter, expandedProjectAndWorkspaceIds]);

  const collectionByWorkspaceId = useMultipleCollectionWorkspaceChildrenData(collectionWorkspaceIds);

  const nonKonnectProjects = useMemo(() => projects.filter(p => !p.konnectControlPlaneId), [projects]);
  const konnectProjects = useMemo(() => projects.filter(p => p.konnectControlPlaneId != null), [projects]);

  return {
    organizationProjects: projects,
    organizationWorkspaces: workspaces,
    workspaceMetas,
    activeProjects,
    projectIds,
    collectionWorkspaceIds,
    collectionByWorkspaceId,
    nonKonnectProjects,
    konnectProjects,
  };
}
