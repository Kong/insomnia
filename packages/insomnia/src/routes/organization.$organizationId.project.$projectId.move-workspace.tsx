import { href } from 'react-router';

import * as models from '~/models';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.move-workspace';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const projectId = formData.get('projectId');
  const workspaceId = formData.get('workspaceId');
  invariant(typeof projectId === 'string', 'Project ID is required');
  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  await models.workspace.update(workspace, {
    parentId: projectId,
  });

  return null;
}

export const useProjectMoveWorkspaceActionFetcher = createFetcherSubmitHook(
  submit => (organizationId: string, projectId: string, workspaceId: string) => {
    const formData = new FormData();
    formData.set('projectId', projectId);
    formData.set('workspaceId', workspaceId);

    return submit(formData, {
      method: 'POST',
      action: href(`/organization/:organizationId/project/:projectId/move-workspace`, {
        organizationId,
        projectId,
      }),
    });
  },
  clientAction,
);
