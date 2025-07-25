import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment.set-active';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const formData = await request.formData();

  const environmentId = formData.get('environmentId');
  invariant(typeof environmentId === 'string', 'Environment ID is required');

  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);
  invariant(workspaceMeta, 'Workspace meta not found');

  await models.workspaceMeta.update(workspaceMeta, { activeEnvironmentId: environmentId || null });

  return null;
}

export function useSetActiveEnvironmentFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientAction>(args);

  function submit({
    organizationId,
    projectId,
    workspaceId,
    environmentId,
  }: {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    environmentId: string;
  }) {
    return fetcher.submit(
      {
        environmentId,
      },
      {
        method: 'POST',
        action: href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/environment/set-active', {
          organizationId,
          projectId,
          workspaceId,
        }),
      },
    );
  }

  return {
    ...fetcher,
    submit,
  };
}
