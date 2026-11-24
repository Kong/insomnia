import type { BaseModel, Workspace } from 'insomnia-data';
import { models } from 'insomnia-data';
import { redirect } from 'react-router';

import { database } from '~/common/database';

export interface ResourceLocation {
  projectId: string;
  workspaceId: string;
}

// Resolves the project/workspace a resource actually lives in by walking up its parentId chain.
// URLs and tabs capture these ids once, so they go stale when a collection is moved to another
// project or a request/folder is moved to another collection.
// Returns null when the chain doesn't end at a workspace (e.g. the parent was deleted).
export const resolveResourceLocation = async (doc: BaseModel): Promise<ResourceLocation | null> => {
  const workspace = models.workspace.isWorkspace(doc)
    ? doc
    : (await database.withAncestors<BaseModel>(doc, [models.requestGroup.type, models.workspace.type])).find(
        (ancestor): ancestor is Workspace => models.workspace.isWorkspace(ancestor),
      );

  if (!workspace?.parentId) {
    return null;
  }

  return { projectId: workspace.parentId, workspaceId: workspace._id };
};

const WORKSPACE_URL_PREFIX = /^(\/organization\/[^/]+\/project\/)[^/]+(\/workspace\/)[^/?#]+/;

// Points a workspace-scoped URL at a new project/workspace, keeping the rest of the path and the query.
// URLs that aren't workspace-scoped are returned unchanged.
export const rewriteWorkspaceUrl = (url: string, location: ResourceLocation) =>
  url.replace(
    WORKSPACE_URL_PREFIX,
    (_, projectPrefix: string, workspacePrefix: string) =>
      `${projectPrefix}${location.projectId}${workspacePrefix}${location.workspaceId}`,
  );

// Loader guard: when the URL's project/workspace segments don't match where `doc` actually lives
// (stale tab, history entry or restored location), redirect to the same page at its real location.
// Only use it in loaders that are never fetcher-loaded: a redirect thrown for a fetcher navigates the app.
export const redirectIfResourceMoved = async (
  doc: BaseModel,
  params: ResourceLocation,
  request: Request,
): Promise<void> => {
  const location = await resolveResourceLocation(doc);
  if (!location || (location.projectId === params.projectId && location.workspaceId === params.workspaceId)) {
    return;
  }
  const url = new URL(request.url);
  throw redirect(rewriteWorkspaceUrl(url.pathname + url.search, location));
};
