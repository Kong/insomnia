import { type ActionFunction } from 'react-router';

import { database } from '../../common/database';
import * as models from '../../models';
import { isRequestGroup } from '../../models/request-group';
import { isRequestGroupMeta } from '../../models/request-group-meta';
import { invariant } from '../../utils/invariant';

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
