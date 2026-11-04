import type { Project, Workspace } from 'insomnia-data';
import { services } from 'insomnia-data';
import { href, redirect } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.delete';

async function deleteWorkspaceFromLocal(workspace: Workspace) {
  await services.stats.incrementDeletedRequestsForDescendents(workspace);
  await services.workspace.remove(workspace);
}

async function deleteWorkspace(
  workspace: Workspace | null,
  project: Project | null,
): Promise<{ error?: string } | null> {
  invariant(workspace, 'Workspace not found');
  invariant(project, 'Project not found');

  await deleteWorkspaceFromLocal(workspace);

  return null;
}

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId, projectId } = params;

  const project = await services.project.getById(projectId);
  invariant(project, 'Project not found');
  const formData = await request.formData();

  const workspaceId = formData.get('workspaceId');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const workspace = await services.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const msgObj = await deleteWorkspace(workspace, project);

  if (msgObj?.error) {
    return msgObj;
  }

  return redirect(
    href(`/organization/:organizationId/project/:projectId`, {
      organizationId,
      projectId,
    }),
  );
}

export const useWorkspaceDeleteActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      // for cloud sync workspaces, delete only local file or also delete remote copy
      localOnly = 'true',
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      localOnly?: 'true' | 'false';
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/delete', {
        organizationId,
        projectId,
      });

      const formData = new FormData();
      formData.append('workspaceId', workspaceId);
      formData.append('localOnly', localOnly);

      return submit(formData, {
        action: url,
        method: 'POST',
      });
    },
  clientAction,
);
