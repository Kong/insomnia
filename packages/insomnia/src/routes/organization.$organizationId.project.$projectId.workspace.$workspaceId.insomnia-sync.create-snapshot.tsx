import { services } from 'insomnia-data';
import { href } from 'react-router';

import { remoteCompareCache } from '~/ui/sync-utils';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.create-snapshot';

interface CreateSnapshotData {
  message: string;
  push?: boolean;
}

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { projectId, workspaceId } = params;

  const data = (await request.json()) as CreateSnapshotData;

  invariant(typeof data.message === 'string', 'Message is required');

  try {
    await window.main.sync.takeSnapshot(data.message);
    if (data.push) {
      const project = await services.project.get(projectId);
      invariant(project, 'Project not found');
      invariant(project.remoteId, 'Project is not remote');

      await window.main.sync.push({
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

export const useInsomniaSyncCreateSnapshotActionFetcher = createFetcherSubmitHook(
  submit =>
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
      return submit(JSON.stringify({ message, push }), {
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
  clientAction,
);
