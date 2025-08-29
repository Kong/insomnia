import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { remoteCompareCache } from '~/ui/sync-utils';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.create-snapshot';

interface CreateSnapshotData {
  message: string;
  push?: boolean;
}

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { projectId, workspaceId } = params;

  const data = (await request.json()) as CreateSnapshotData;

  invariant(typeof data.message === 'string', 'Message is required');

  const vcs = VCSInstance();

  try {
    await vcs.takeSnapshot(data.message);
    if (data.push) {
      const project = await models.project.getById(projectId);
      invariant(project, 'Project not found');
      invariant(project.remoteId, 'Project is not remote');

      await vcs.push({
        teamId: project.parentId,
        teamProjectId: project.remoteId,
      });
    }

    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while creating snapshot.';

    return {
      error: errorMessage,
    };
  }

  return null;
}

export function useInsomniaSyncCreateSnapshotActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({
      message,
      push,
      organizationId,
      projectId,
      workspaceId,
    }: {
      message: string;
      organizationId: string;
      projectId: string;
      workspaceId: string;
      push?: boolean;
    }) => {
      return fetcherSubmit(JSON.stringify({ message, push }), {
        method: 'POST',
        action: href(
          `/organization/:organizationId/project/:projectId/workspace/:workspaceId/insomnia-sync/create-snapshot`,
          {
            organizationId,
            projectId,
            workspaceId,
          },
        ),
        encType: 'application/json',
      });
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
