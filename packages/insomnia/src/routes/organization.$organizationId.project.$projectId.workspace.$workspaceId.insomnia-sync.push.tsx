import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import * as models from '~/models';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { SegmentEvent } from '~/ui/analytics';
import { remoteCompareCache, vcsSegmentEventProperties } from '~/ui/sync-utils';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.push';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { projectId, workspaceId } = params;

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');
  invariant(project.remoteId, 'Project is not remote');

  try {
    const vcs = VCSInstance();
    await vcs.push({
      teamId: project.parentId,
      teamProjectId: project.remoteId,
    });

    window.main.trackSegmentEvent({
      event: SegmentEvent.vcsAction,
      properties: vcsSegmentEventProperties('remote', 'push'),
    });

    delete remoteCompareCache[workspaceId];
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while pushing to remote.';

    window.main.trackSegmentEvent({
      event: SegmentEvent.vcsAction,
      properties: vcsSegmentEventProperties('remote', 'push', errorMessage),
    });

    return {
      error: errorMessage,
    };
  }

  return null;
}

export function useInsomniaSyncPushActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({
      organizationId,
      projectId,
      workspaceId,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/insomnia-sync/push', {
        organizationId,
        projectId,
        workspaceId,
      });

      return fetcherSubmit(
        {},
        {
          action: url,
          method: 'POST',
        },
      );
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
