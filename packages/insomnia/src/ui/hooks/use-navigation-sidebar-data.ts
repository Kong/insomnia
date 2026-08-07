import { useMemo } from 'react';

import { useMultipleCollectionWorkspaceChildrenData, useOrganizationData } from '~/ui/hooks/use-insomnia-app-data';

interface UseProjectNavigationSidebarDataOptions {
  projectNavigationSidebarFilter?: string;
  expandedProjectAndWorkspaceIds?: string[];
}

export function useProjectNavigationSidebarData(
  organizationId: string,
  options: UseProjectNavigationSidebarDataOptions,
) {
  const { projectNavigationSidebarFilter, expandedProjectAndWorkspaceIds } = options;
  const { projects, workspaces, workspaceMetas } = useOrganizationData(organizationId);
  const projectIds = useMemo(() => projects.map(p => p._id), [projects]);
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

  return {
    organizationProjects: projects,
    organizationWorkspaces: workspaces,
    workspaceMetas,
    projectIds,
    collectionWorkspaceIds,
    collectionByWorkspaceId,
  };
}
