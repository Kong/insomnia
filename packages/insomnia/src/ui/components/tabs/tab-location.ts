import type { NavigationResources } from '~/ui/hooks/use-insomnia-navigation';
import { resolveResourceLocation, type ResourceLocation, rewriteWorkspaceUrl } from '~/ui/utils/resource-location';

import type { BaseTab } from '../../context/app/insomnia-tab-context';

export interface TabLocation extends ResourceLocation {
  projectName: string;
  workspaceName: string;
}

// Builds the patches that point the given tabs at a new project/workspace, so clicking them
// navigates to where the resource lives now. Tabs already at that location are skipped.
export const buildTabLocationUpdates = (tabs: BaseTab[], location: TabLocation) =>
  tabs
    .filter(tab => tab.projectId !== location.projectId || tab.workspaceId !== location.workspaceId)
    .map(tab => ({
      id: tab.id,
      fields: {
        projectId: location.projectId,
        projectName: location.projectName,
        workspaceId: location.workspaceId,
        workspaceName: location.workspaceName,
        url: rewriteWorkspaceUrl(tab.url, location),
      } satisfies Partial<BaseTab>,
    }));

// For an open tab whose stored location differs from the route it's showing (its resource moved while
// the tab wasn't synced, then a route guard redirected to the real location), builds the patch that
// persists the route's location onto the tab. Returns null unless the route is known to be accurate:
// its workspace belongs to its project, and its resource lives in that workspace (routes without a
// loader guard, such as a folder runner, can still sit on a stale workspace).
export const getRouteTabLocationUpdate = async (
  tab: BaseTab,
  { project, workspace, resource }: NavigationResources,
) => {
  if (!project || !workspace || workspace.parentId !== project._id) {
    return null;
  }
  if (tab.projectId === project._id && tab.workspaceId === workspace._id) {
    return null;
  }
  const resourceLocation = resource ? await resolveResourceLocation(resource) : null;
  if (resourceLocation && resourceLocation.workspaceId !== workspace._id) {
    return null;
  }
  const [update] = buildTabLocationUpdates([tab], {
    projectId: project._id,
    projectName: project.name,
    workspaceId: workspace._id,
    workspaceName: workspace.name,
  });
  return update ?? null;
};
