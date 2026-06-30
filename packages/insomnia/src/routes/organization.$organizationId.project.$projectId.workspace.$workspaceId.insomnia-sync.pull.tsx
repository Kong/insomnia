import { services } from 'insomnia-data';
import { href } from 'react-router';

import { database } from '~/common/database';
import { invariant } from '~/common/utils/invariant';
import { AnalyticsEvent } from '~/ui/analytics';
import { getSyncItems, remoteCompareCache, reparentSyncDelta, vcsEventProperties } from '~/ui/sync-utils';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.pull';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { projectId, workspaceId } = params;

  const project = await services.project.getById(projectId);
  invariant(project, 'Project not found');
  const { syncItems } = await getSyncItems({ workspaceId });
  try {
    invariant(project.remoteId, 'Project is not remote');
    const delta = await window.main.sync.pull({
      candidates: syncItems,
      teamId: project.parentId,
      teamProjectId: project.remoteId,
      projectId: project._id,
    });

    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.vcsAction,
      properties: vcsEventProperties('remote', 'pull'),
    });
    // This is to synchronize the local database with the branch changes
    await database.batchModifyDocs(reparentSyncDelta(delta, projectId));
    delete remoteCompareCache[workspaceId];

    return {
      success: true,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while pulling from remote.';

    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.vcsAction,
      properties: vcsEventProperties('remote', 'pull', errorMessage),
    });

    return {
      error: errorMessage,
    };
  }
}

export const useInsomniaSyncPullActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
    }) => {
      return submit(
        {},
        {
          action: href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/insomnia-sync/pull', {
            organizationId,
            projectId,
            workspaceId,
          }),
          method: 'POST',
        },
      );
    },
  clientAction,
);
