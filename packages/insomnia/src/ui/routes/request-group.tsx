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
  await models.requestGroupMeta.create({ parentId: requestGroup._id, collapsed: false });
  return null;
};
export const updateRequestGroupAction: ActionFunction = async ({ request, params }) => {
  const { requestGroupId } = params;
  invariant(typeof requestGroupId === 'string', 'Request Group ID is required');
  const reqGroup = await models.requestGroup.getById(requestGroupId);
  invariant(reqGroup, 'Request Group not found');
  const patch = await request.json() as RequestGroup;
  await models.requestGroup.update(reqGroup, patch);
  return null;
};
export const deleteRequestGroupAction: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const id = formData.get('id') as string;
  const requestGroup = await models.requestGroup.getById(id);
  invariant(requestGroup, 'Request Group not found');
  models.stats.incrementDeletedRequestsForDescendents(requestGroup);
  await models.requestGroup.remove(requestGroup);
  return null;
};

export const duplicateRequestGroupAction: ActionFunction = async ({ request }) => {
  const patch = await request.json() as Partial<RequestGroup>;
  invariant(patch._id, 'Request group id not found');
  const requestGroup = await models.requestGroup.getById(patch._id);
  invariant(requestGroup, 'Request group not found');
  if (patch.parentId) {
    const workspace = await models.workspace.getById(patch.parentId);
    invariant(workspace, 'Workspace is required');
    // TODO: if gRPC, we should also copy the protofile to the destination workspace - INS-267
    // Move to top of sort order
    const newRequestGroup = await models.requestGroup.duplicate(requestGroup, { name: patch.name, parentId: patch.parentId, metaSortKey: -1e9 });
    models.stats.incrementCreatedRequestsForDescendents(newRequestGroup);
    return null;
  }
  const newRequestGroup = await models.requestGroup.duplicate(requestGroup, { name: patch.name });
  models.stats.incrementCreatedRequestsForDescendents(newRequestGroup);
  return null;
};

export const updateRequestGroupMetaAction: ActionFunction = async ({ request, params }) => {
  const { requestGroupId } = params;
  invariant(typeof requestGroupId === 'string', 'Request Group ID is required');
  const patch = await request.json() as Partial<RequestGroupMeta>;
  const requestGroupMeta = await models.requestGroupMeta.getByParentId(requestGroupId);
  if (requestGroupMeta) {
    await models.requestGroupMeta.update(requestGroupMeta, patch);
    return null;
  }
  await models.requestGroupMeta.create({ parentId: requestGroupId, collapsed: false });
  return null;
};
