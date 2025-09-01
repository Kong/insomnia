import { href } from 'react-router';

import { database } from '~/common/database';
import * as models from '~/models';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { SegmentEvent } from '~/ui/analytics';
import { getSyncItems, remoteCompareCache, vcsSegmentEventProperties } from '~/ui/sync-utils';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.pull';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { projectId, workspaceId } = params;

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');
  const { syncItems } = await getSyncItems({ workspaceId });
  try {
    invariant(project.remoteId, 'Project is not remote');
    const vcs = VCSInstance();
    const delta = await vcs.pull({
      candidates: syncItems,
      teamId: project.parentId,
      teamProjectId: project.remoteId,
      projectId: project._id,
    });

    window.main.trackSegmentEvent({
      event: SegmentEvent.vcsAction,
      properties: vcsSegmentEventProperties('remote', 'pull'),
    });
    // This is to synchronize the local database with the branch changes
    await database.batchModifyDocs(delta);
    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while pulling from remote.';

    window.main.trackSegmentEvent({
      event: SegmentEvent.vcsAction,
      properties: vcsSegmentEventProperties('remote', 'pull', errorMessage),
    });

    return {
      error: errorMessage,
    };
  }

  return {
    error: null,
    success: true,
  };
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
