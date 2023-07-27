import { ActionFunction } from 'react-router-dom';

import * as models from '../../models';
import { RequestGroup } from '../../models/request-group';
import { invariant } from '../../utils/invariant';

export const createRequestGroupAction: ActionFunction = async ({ request, params }) => {
  const { workspaceId } = params;
  const formData = await request.formData();
  const name = formData.get('name') as string;
  const parentId = formData.get('parentId') as string;
  const requestGroup = await models.requestGroup.create({ parentId: parentId || workspaceId, name });
  models.requestGroupMeta.create({ parentId: requestGroup._id, collapsed: false });
  return null;
};
export const updateRequestGroupAction: ActionFunction = async ({ request }) => {
  const patch = await request.json() as RequestGroup;
  invariant(typeof patch._id === 'string', 'Request Group ID is required');
  const reqGroup = await models.requestGroup.getById(patch._id);
  invariant(reqGroup, 'Request Group not found');
  if (name !== null) {
    models.requestGroup.update(reqGroup, patch);
  }
  return null;
};
export const deleteRequestGroupAction: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const id = formData.get('id') as string;
  const requestGroup = await models.requestGroup.getById(id);
  invariant(requestGroup, 'Request not found');
  models.stats.incrementDeletedRequestsForDescendents(requestGroup);
  models.requestGroup.remove(requestGroup);
  return null;
};
