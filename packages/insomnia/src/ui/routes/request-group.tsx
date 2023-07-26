import { ActionFunction } from 'react-router-dom';

import * as models from '../../models';
import { invariant } from '../../utils/invariant';

export const createRequestGroupAction: ActionFunction = async ({ request, params }) => {
  const { workspaceId } = params;
  const formData = await request.formData();
  const name = formData.get('name') as string;
  const parentId = formData.get('parentId') as string;
  const requestGroup = await models.requestGroup.create({ parentId: parentId || workspaceId, name });
  models.requestGroupMeta.create({ parentId: requestGroup._id, collapsed: false });
};
export const updateRequestGroupAction: ActionFunction = async ({ request, params }) => {
  const { requestGroupId } = params;
  invariant(typeof requestGroupId === 'string', 'Request Group ID is required');
  const reqGroup = await models.requestGroup.getById(requestGroupId);
  invariant(reqGroup, 'Request Group not found');
  const formData = await request.formData();
  const name = formData.get('name') as string | null;
  if (name !== null) {
    models.requestGroup.update(reqGroup, { name });
  }
};
export const deleteRequestGroupAction: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const id = formData.get('id') as string;
  const requestGroup = await models.requestGroup.getById(id);
  invariant(requestGroup, 'Request not found');
  models.stats.incrementDeletedRequestsForDescendents(requestGroup);
  models.requestGroup.remove(requestGroup);
};
