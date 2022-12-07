import * as models from '@insomnia/models';

import { database as db } from '@insomnia/common/database';
import type { ApiSpec } from '../api-spec';
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
