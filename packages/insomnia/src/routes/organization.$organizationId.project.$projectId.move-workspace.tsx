import { services } from 'insomnia-data';
import { href } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.move-workspace';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const projectId = formData.get('projectId');
  const workspaceId = formData.get('workspaceId');
  invariant(typeof projectId === 'string', 'Project ID is required');
  const project = await services.project.get(projectId);
  invariant(project, 'Project not found');

  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const workspace = await services.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  await services.workspace.update(workspace, {
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
