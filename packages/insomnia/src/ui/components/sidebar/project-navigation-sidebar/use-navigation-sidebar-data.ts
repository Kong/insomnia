import type { WorkspaceChildrenForScope } from 'insomnia-data';
import { useMemo } from 'react';

import { useOrganizationData } from '~/ui/hooks/use-organization-data';
import { useMultipleWorkspacesData } from '~/ui/hooks/use-workspace-data';

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

  const nonKonnectProjects = useMemo(() => projects.filter(p => !p.konnectControlPlaneId), [projects]);
  const konnectProjects = useMemo(() => projects.filter(p => p.konnectControlPlaneId != null), [projects]);

  return {
    organizationProjects: projects,
    organizationWorkspaces: workspaces,
    workspaceMetas,
    activeProjects,
    projectIds,
    collectionOrDesignWorkspaceIds,
    collectionByWorkspaceIds: collectionByWorkspaceIds as Map<
      string,
      WorkspaceChildrenForScope<'collection' | 'design'>
    >,
    pendingCollectionWorkspaceIds,
    nonKonnectProjects,
    konnectProjects,
  };
}
