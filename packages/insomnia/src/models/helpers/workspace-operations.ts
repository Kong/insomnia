import { database as db } from '../../common/database';
import type { ApiSpec } from '../api-spec';
import * as models from '../index';
import { isDesign, Workspace } from '../workspace';

export async function rename(workspace: Workspace, apiSpec: ApiSpec, name: string) {
  if (isDesign(workspace)) {
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

export function update<T extends object>(workspace: T, patch: Partial<T> = {}): Promise<T> {
  // @ts-expect-error -- TSCONVERSION
  return models.workspace.update(workspace, patch);
}
