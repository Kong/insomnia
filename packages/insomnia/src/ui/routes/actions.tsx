import { type ActionFunction, redirect } from 'react-router';

import { database } from '../../common/database';
import * as models from '../../models';
import { getById, update } from '../../models/helpers/request-operations';
import { isRequestGroup, isRequestGroupId } from '../../models/request-group';
import { isRequestGroupMeta } from '../../models/request-group-meta';
import { invariant } from '../../utils/invariant';
import { SegmentEvent } from '../analytics';

export function safeToUseInsomniaFileName(fileName: string) {
  const fileNameWithoutExt = fileName.replace('.yaml', '').replace('.yml', '');
  const fileNameWithSafeCharacters = fileNameWithoutExt
    .toLowerCase()
    .trim()
    // Replace all non-alphanumeric characters with underscores, allow -
    .replace(/[^a-z0-9_-]/g, '_');

  return fileNameWithSafeCharacters;
}

export function safeToUseInsomniaFileNameWithExt(fileName: string) {
  return `${safeToUseInsomniaFileName(fileName)}.yaml`;
}

export const updateSettingsAction: ActionFunction = async ({ request }) => {
  const patch = await request.json();
  if ('enableAnalytics' in patch && !patch.enableAnalytics) {
    window.main.trackSegmentEvent({ event: SegmentEvent.analyticsDisabled });
  }
  await models.settings.patch(patch);
  return null;
};

const getCollectionItem = async (id: string) => {
  let item;
  if (isRequestGroupId(id)) {
    item = await models.requestGroup.getById(id);
  } else {
    item = await getById(id);
  }

  invariant(item, 'Item not found');

  return item;
};

export const reorderCollectionAction: ActionFunction = async ({ request, params }) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const { id, targetId, dropPosition, metaSortKey } = await request.json();
  invariant(typeof id === 'string', 'ID is required');
  invariant(typeof targetId === 'string', 'Target ID is required');
  invariant(typeof dropPosition === 'string', 'Drop position is required');
  invariant(typeof metaSortKey === 'number', 'MetaSortKey position is required');

  if (id === targetId) {
    return null;
  }

  const item = await getCollectionItem(id);
  const targetItem = await getCollectionItem(targetId);

  const parentId = dropPosition === 'after' && isRequestGroup(targetItem) ? targetItem._id : targetItem.parentId;

  if (isRequestGroup(item)) {
    await models.requestGroup.update(item, { parentId, metaSortKey });
  } else {
    await update(item, { parentId, metaSortKey });
  }

  return null;
};

export const createMockRouteAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, projectId, workspaceId } = params;

  const patch = await request.json();
  invariant(typeof patch.name === 'string', 'Name is required');
  // TODO: remove this hack which enables a mock server to be created alongside a route
  // TODO: use an alternate method to create new workspace and server together
  // create a mock server under the workspace with the same name
  if (patch.mockServerName) {
    const collectionWorkspace = await models.workspace.getById(workspaceId);
    invariant(collectionWorkspace, 'Collection workspace not found');
    const mockWorkspace = await models.workspace.create({
      name: collectionWorkspace.name,
      scope: 'mock-server',
      parentId: projectId,
    });
    invariant(mockWorkspace, 'Workspace not found');
    const newMockServer = await models.mockServer.getOrCreateForParentId(mockWorkspace._id, {
      name: collectionWorkspace.name,
    });
    delete patch.mockServerName;
    const mockRoute = await models.mockRoute.create({ ...patch, parentId: newMockServer._id });
    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${newMockServer.parentId}/mock-server/mock-route/${mockRoute._id}`,
    );
  }
  const mockServer = await models.mockServer.getById(patch.parentId);
  invariant(mockServer, 'Mock server not found');
  const mockRoute = await models.mockRoute.create(patch);
  return redirect(
    `/organization/${organizationId}/project/${projectId}/workspace/${mockServer.parentId}/mock-server/mock-route/${mockRoute._id}`,
  );
};
export const updateMockRouteAction: ActionFunction = async ({ request, params }) => {
  const { mockRouteId } = params;
  invariant(typeof mockRouteId === 'string', 'Mock route id is required');
  const patch = await request.json();

  const mockRoute = await models.mockRoute.getById(mockRouteId);
  invariant(mockRoute, 'Mock route is required');

  await models.mockRoute.update(mockRoute, patch);
  return null;
};
export const deleteMockRouteAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, projectId, workspaceId, mockRouteId } = params;
  invariant(typeof mockRouteId === 'string', 'Mock route id is required');
  const mockRoute = await models.mockRoute.getById(mockRouteId);
  invariant(mockRoute, 'mockRoute not found');
  const { isSelected } = await request.json();

  await models.mockRoute.remove(mockRoute);
  if (isSelected) {
    return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server`);
  }
  return null;
};
export const updateMockServerAction: ActionFunction = async ({ request, params }) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const patch = await request.json();
  const mockServer = await models.mockServer.getByParentId(workspaceId);
  invariant(mockServer, 'Mock server not found');
  await models.mockServer.update(mockServer, patch);
  return null;
};

export const toggleExpandAllRequestGroupsAction: ActionFunction = async ({ params, request }) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');
  const data = (await request.json()) as {
    toggle: 'collapse-all' | 'expand-all';
  };
  const isCollapsed = data.toggle === 'collapse-all';

  const descendants = await database.withDescendants(workspace);
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
};
