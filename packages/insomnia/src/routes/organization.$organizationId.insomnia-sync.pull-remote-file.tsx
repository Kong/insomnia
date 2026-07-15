import { models, services } from 'insomnia-data';
import { href, redirect } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.insomnia-sync.pull-remote-file';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId } = params;

  try {
    const formData = await request.formData();

    const backendProjectId = formData.get('backendProjectId');
    invariant(typeof backendProjectId === 'string', 'Collection Id is required');
    const remoteId = formData.get('remoteId');
    invariant(typeof remoteId === 'string', 'Remote Id is required');

    const { projectId, workspaceId } = await window.main.sync.pullRemoteBackendProject({
      organizationId,
      backendProjectId,
      remoteId,
    });
    invariant(typeof workspaceId === 'string', 'Workspace not found after pulling remote collection');

    const workspace = await services.workspace.getById(workspaceId);

    invariant(workspace, 'Workspace not found');
    const activity = models.workspace.scopeToActivity(workspace?.scope);

    return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/${activity}`);
  } catch (e) {
    console.warn('Failed to pull remote collection', e);
    return {
      error: 'Failed to pull remote collection',
    };
  }
}

export const useInsomniaSyncPullRemoteFileActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      backendProjectId,
      remoteId,
    }: {
      organizationId: string;
      backendProjectId: string;
      remoteId: string;
    }) => {
      const url = href('/organization/:organizationId/insomnia-sync/pull-remote-file', {
        organizationId,
      });

      const formData = new FormData();
      formData.set('backendProjectId', backendProjectId);
      formData.set('remoteId', remoteId);

      return submit(formData, {
        action: url,
        method: 'POST',
      });
    },
  clientAction,
);
