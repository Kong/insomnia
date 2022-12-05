import { LoaderFunction } from 'react-router-dom';

import { database } from '../../common/database';
import * as models from '../../models';
import { invariant } from '../../utils/invariant';

export const workspaceLoader: LoaderFunction = async ({
  params,
}) => {
  const { workspaceId } = params;
  invariant(workspaceId, 'Workspace ID is required');

  const workspace = await models.workspace.getById(workspaceId);

  invariant(workspace, 'Workspace not found');

  const workspaceEnvironments = await models.environment.findByParentId(workspaceId);
  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);
  const cookieJar = await models.cookieJar.getOrCreateForParentId(workspaceId);
  const apiSpec = await models.apiSpec.getByParentId(workspaceId);

  const workspaceHasChildren = workspaceEnvironments.length && cookieJar && apiSpec && workspaceMeta;
  if (workspaceHasChildren) {
    return;
  }

  const flushId = await database.bufferChanges();
  await models.workspace.ensureChildren(workspace);
  await database.flushChanges(flushId);
};
