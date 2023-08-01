import { ActionFunction } from 'react-router-dom';

import * as models from '../../models';
import { RequestGroup } from '../../models/request-group';
import { RequestGroupMeta } from '../../models/request-group-meta';
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
  models.requestGroup.update(reqGroup, patch);
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

export const updateRequestGroupMetaAction: ActionFunction = async ({ request, params }) => {
  const { requestGroupId } = params;
  invariant(typeof requestGroupId === 'string', 'Request Group ID is required');
  const patch = await request.json() as Partial<RequestGroupMeta>;
  const requestGroupMeta = await models.requestGroupMeta.getByParentId(requestGroupId);
  if (requestGroupMeta) {
    models.requestGroupMeta.update(requestGroupMeta, patch);
    return null;
  }
  models.requestGroupMeta.create({ parentId: requestGroupId, collapsed: false });
  return null;
};
