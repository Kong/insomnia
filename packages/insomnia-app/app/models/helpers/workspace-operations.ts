import { database as db } from '../../common/database';
import type { ApiSpec } from '../api-spec';
import * as models from '../index';
import { isDesign, Workspace } from '../workspace';

export async function rename(w: Workspace, s: ApiSpec, name: string) {
  if (isDesign(w)) {
    await models.apiSpec.update(s, {
      fileName: name,
    });
  } else {
    await models.workspace.update(w, {
      name,
    });
  }
}

export async function duplicate(w: Workspace, { name, parentId }: Pick<Workspace, 'name' | 'parentId'>) {
  const newWorkspace = await db.duplicate(w, {
    name,
    parentId,
  });
  await models.apiSpec.updateOrCreateForParentId(newWorkspace._id, {
    fileName: name,
  });
  models.stats.incrementCreatedRequestsForDescendents(newWorkspace);
  return newWorkspace;
}
