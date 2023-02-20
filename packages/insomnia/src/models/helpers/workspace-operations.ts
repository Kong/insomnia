import { DashboardSortOrder } from '../../common/constants';
import { database as db } from '../../common/database';
import { sortMethodMap } from '../../common/sorting';
import type { ApiSpec } from '../api-spec';
import * as models from '../index';
import { isDesign, Workspace } from '../workspace';

export async function rename(name: string, workspace: Workspace, apiSpec?: ApiSpec) {
  if (isDesign(workspace) && apiSpec) {
    await models.apiSpec.update(apiSpec, {
      fileName: name,
    });
  } else {
    await models.workspace.update(workspace, {
      name,
    });
  }
}

export async function duplicate(
  workspace: Workspace,
  { name, parentId }: Pick<Workspace, 'name' | 'parentId'>,
) {
  const newWorkspace = await db.duplicate(workspace, {
    name,
    parentId,
  });
  await models.apiSpec.updateOrCreateForParentId(newWorkspace._id, {
    fileName: name,
  });
  models.stats.incrementCreatedRequestsForDescendents(newWorkspace);
  return newWorkspace;
}

interface WorkspaceWithMetadata {
  hasUnsavedChanges: boolean;
  lastModifiedTimestamp: number;
  modifiedLocally: number;
  lastCommitTime: number | null | undefined;
  lastCommitAuthor: string | null | undefined;
  lastActiveBranch: string | null | undefined;
  spec: Record<string, any> | null;
  specFormat: 'openapi' | 'swagger' | null;
  name: string;
  apiSpec: ApiSpec;
  specFormatVersion: string | null;
  workspace: Workspace;
}

export const sortWorkspaces = (sortOrder: DashboardSortOrder, workspaces: WorkspaceWithMetadata[]) =>   workspaces.sort((workspaceWithMetaA, workspaceWithMetaB) => {
  switch (sortOrder) {
    case 'modified-desc':
      return sortMethodMap['modified-desc'](
        workspaceWithMetaA,
        workspaceWithMetaB
      );
    case 'name-asc':
      return sortMethodMap['name-asc'](
        workspaceWithMetaA.workspace,
        workspaceWithMetaB.workspace
      );
    case 'name-desc':
      return sortMethodMap['name-desc'](
        workspaceWithMetaA.workspace,
        workspaceWithMetaB.workspace
      );
    case 'created-asc':
      return sortMethodMap['created-asc'](
        workspaceWithMetaA.workspace,
        workspaceWithMetaB.workspace
      );
    case 'created-desc':
      return sortMethodMap['created-desc'](
        workspaceWithMetaA.workspace,
        workspaceWithMetaB.workspace
      );
    default:
      throw new Error(`Invalid sort order: ${sortOrder}`);
  }
});
