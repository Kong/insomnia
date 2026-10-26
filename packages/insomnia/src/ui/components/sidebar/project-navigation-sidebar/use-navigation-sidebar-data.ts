import type { WorkspaceChildrenForScope } from 'insomnia-data';
import { useMemo } from 'react';

import { useOrganizationData } from '~/ui/hooks/use-organization-data';
import { useMultipleWorkspacesData } from '~/ui/hooks/use-workspace-data';

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

  // Get the list of collection/design workspace ids that should be cached based on the current filter and expanded projects/workspaces.
  const collectionOrDesignWorkspaceIds = useMemo(() => {
    const ids: string[] = [];
    projectIds.forEach(projectId => {
      workspaces
        .filter(w => w.parentId === projectId)
        .forEach(workspace => {
          if (
            (workspace.scope === 'collection' || workspace.scope === 'design') &&
            (!!projectNavigationSidebarFilter || (expandedProjectAndWorkspaceIds || []).includes(workspace._id))
          ) {
            ids.push(workspace._id);
          }
        });
    });
    return ids;
  }, [projectIds, workspaces, projectNavigationSidebarFilter, expandedProjectAndWorkspaceIds]);

  const { dataByWorkspaceId: collectionByWorkspaceIds, pendingWorkspaceIds: pendingCollectionWorkspaceIds } =
    useMultipleWorkspacesData(collectionOrDesignWorkspaceIds);

  return {
    organizationProjects: projects,
    organizationWorkspaces: workspaces,
    workspaceMetas,
    projectIds,
    collectionOrDesignWorkspaceIds,
    collectionByWorkspaceIds: collectionByWorkspaceIds as Map<
      string,
      WorkspaceChildrenForScope<'collection' | 'design'>
    >,
    pendingCollectionWorkspaceIds,
  };
}
