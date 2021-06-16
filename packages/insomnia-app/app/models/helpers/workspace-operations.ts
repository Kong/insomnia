import * as models from '../index';
import { database as db } from '../../common/database';
import { isDesign, Workspace } from '../workspace';
import type { ApiSpec } from '../api-spec';

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

export async function duplicate(w: Workspace, name: string) {
  const newWorkspace = await db.duplicate(w, {
    name,
  });
  await models.apiSpec.updateOrCreateForParentId(newWorkspace._id, {
    fileName: name,
  });
  models.stats.incrementCreatedRequestsForDescendents(newWorkspace);
  return newWorkspace;
}
