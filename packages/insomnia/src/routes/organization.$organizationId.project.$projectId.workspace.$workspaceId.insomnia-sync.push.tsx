import { href } from 'react-router';

import { services } from '~/insomnia-data';
import { AnalyticsEvent } from '~/ui/analytics';
import { remoteCompareCache, vcsEventProperties } from '~/ui/sync-utils';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.push';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { projectId, workspaceId } = params;

  const project = await services.project.get(projectId);
  invariant(project, 'Project not found');
  invariant(project.remoteId, 'Project is not remote');

  try {
    await window.main.sync.push({
      teamId: project.parentId,
      teamProjectId: project.remoteId,
    });

    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.vcsAction,
      properties: vcsEventProperties('remote', 'push'),
    });

    delete remoteCompareCache[workspaceId];

    return {
      success: true,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while pushing to remote.';

    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.vcsAction,
      properties: vcsEventProperties('remote', 'push', errorMessage),
    });

    return {
      error: errorMessage,
    };
  }
}

export const useInsomniaSyncPushActionFetcher = createFetcherSubmitHook(
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
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/insomnia-sync/push', {
        organizationId,
        projectId,
        workspaceId,
      });

      return submit(
        {},
        {
          action: url,
          method: 'POST',
        },
      );
    },
  clientAction,
);
