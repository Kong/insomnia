import { type ActionFunctionArgs } from 'react-router';

import { database } from '../../common/database';
import * as models from '../../models';
import { isRequestGroup } from '../../models/request-group';
import { isRequestGroupMeta } from '../../models/request-group-meta';
import { invariant } from '../../utils/invariant';

export async function action({ request, params }: ActionFunctionArgs) {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');
  const data = (await request.json()) as {
    toggle: 'collapse-all' | 'expand-all';
  };
  const isCollapsed = data.toggle === 'collapse-all';

  const descendants = await database.withDescendants(workspace, null, [], {
    [workspace.type]: [models.requestGroup.type],
    [models.requestGroup.type]: [models.requestGroup.type, models.requestGroupMeta.type],
  });
  const requestGroups = descendants.filter(isRequestGroup);
  const requestGroupMetas = descendants.filter(isRequestGroupMeta);
  await Promise.all(
    requestGroups.map(requestGroup => {
      const requestGroupMeta = requestGroupMetas.find(meta => meta.parentId === requestGroup._id);

      if (requestGroupMeta) {
        return models.requestGroupMeta.update(requestGroupMeta, { collapsed: isCollapsed });
      }
      return models.requestGroupMeta.create({ parentId: requestGroup._id, collapsed: isCollapsed });
    }),
  );
  return null;
}
