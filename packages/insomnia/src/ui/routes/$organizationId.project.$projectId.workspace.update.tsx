import path from 'node:path';

import { type ActionFunctionArgs } from 'react-router';

import * as models from '../../models';
import { isGitProject } from '../../models/project';
import { safeToUseInsomniaFileNameWithExt } from '../../sync/git/insomnia-filename';
import { invariant } from '../../utils/invariant';

export async function action({ request }: ActionFunctionArgs) {
  const patch = await request.json();
  const workspaceId = patch.workspaceId;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  if (workspace.scope === 'design') {
    const apiSpec = await models.apiSpec.getByParentId(workspaceId);
    invariant(apiSpec, 'No Api Spec found for this workspace');

    await models.apiSpec.update(apiSpec, {
      fileName: patch.name || workspace.name,
    });
  }

  if (workspace.scope === 'mock-server') {
    const mockServer = await models.mockServer.getByParentId(workspaceId);
    invariant(mockServer, 'No MockServer found for this workspace');

    let useInsomniaCloud = mockServer.useInsomniaCloud;
    if (patch.mockServerType && typeof patch.mockServerType === 'string') {
      useInsomniaCloud = patch.mockServerType === 'cloud';
    }

    let mockServerUrl = mockServer.url;

    if (patch.mockServerUrl && typeof patch.mockServerUrl === 'string') {
      mockServerUrl = patch.mockServerUrl;
    }

    await models.mockServer.update(mockServer, {
      name: patch.name || workspace.name,
      useInsomniaCloud,
      url: mockServerUrl,
    });
  }

  patch.name = patch.name || workspace.name || (workspace.scope === 'collection' ? 'My Collection' : 'my-spec.yaml');

  await models.workspace.update(workspace, patch);

  const project = await models.project.getById(workspace.parentId);
  invariant(project, 'Project not found');
  if (isGitProject(project)) {
    const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);

    const existingPathDir = path.dirname(workspaceMeta.gitFilePath || '');
    let fileName = path.basename(workspaceMeta.gitFilePath || '');

    if (patch.fileName && typeof patch.fileName === 'string') {
      fileName = patch.fileName;
    }

    await models.workspaceMeta.update(workspaceMeta, {
      gitFilePath: path.join(existingPathDir, safeToUseInsomniaFileNameWithExt(fileName)),
    });
  }

  return {
    success: true,
  };
}
