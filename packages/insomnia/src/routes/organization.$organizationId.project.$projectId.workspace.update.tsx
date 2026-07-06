import { models, services } from 'insomnia-data';
import { href } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { safeToUseInsomniaFileNameWithExt } from '~/sync/git/insomnia-filename';
import { AnalyticsEvent } from '~/ui/analytics';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.update';

interface WorkspacePatch {
  workspaceId: string;
  name?: string;
  fileName?: string;
  mockServerType?: string;
  mockServerUrl?: string;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const patch = (await request.json()) as WorkspacePatch;
  const workspaceId = patch.workspaceId;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const workspace = await services.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  if (workspace.scope === 'design') {
    const apiSpec = await services.apiSpec.getByParentId(workspaceId);
    invariant(apiSpec, 'No Api Spec found for this workspace');

    await services.apiSpec.update(apiSpec, {
      fileName: patch.name || workspace.name,
    });
  }

  if (workspace.scope === 'mock-server') {
    const mockServer = await services.mockServer.getByParentId(workspaceId);
    invariant(mockServer, 'No MockServer found for this workspace');

    let useInsomniaCloud = mockServer.useInsomniaCloud;
    if (patch.mockServerType && typeof patch.mockServerType === 'string') {
      useInsomniaCloud = patch.mockServerType === 'cloud';
    }

    let mockServerUrl = mockServer.url;

    if (patch.mockServerUrl && typeof patch.mockServerUrl === 'string') {
      mockServerUrl = patch.mockServerUrl;
    }

    await services.mockServer.update(mockServer, {
      name: patch.name || workspace.name,
      useInsomniaCloud,
      url: mockServerUrl,
    });

    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.mockEdit,
    });
  }

  patch.name = patch.name || workspace.name || (workspace.scope === 'collection' ? 'My Collection' : 'my-spec.yaml');

  await services.workspace.update(workspace, patch);

  const project = await services.project.getById(workspace.parentId);
  invariant(project, 'Project not found');
  if (models.project.isGitProject(project)) {
    const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspace._id);

    const existingPathDir = window.path.dirname(workspaceMeta.gitFilePath || '');
    let fileName = window.path.basename(workspaceMeta.gitFilePath || '');

    if (patch.fileName && typeof patch.fileName === 'string') {
      fileName = patch.fileName;
    }

    await services.workspaceMeta.update(workspaceMeta, {
      gitFilePath: window.path.join(existingPathDir, safeToUseInsomniaFileNameWithExt(fileName)),
    });
  }

  return {
    success: true,
  };
}

export const useWorkspaceUpdateActionFetcher = createFetcherSubmitHook(
  submit =>
    ({ organizationId, projectId, patch }: { organizationId: string; projectId: string; patch: WorkspacePatch }) => {
      return submit(JSON.stringify(patch), {
        method: 'POST',
        action: href('/organization/:organizationId/project/:projectId/workspace/update', {
          organizationId,
          projectId,
        }),
        encType: 'application/json',
      });
    },
  clientAction,
);
