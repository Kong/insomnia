import { href } from 'react-router';

import { isNotNullOrUndefined } from '~/common/misc';
import { invariant } from '~/common/utils/invariant';
import { getSyncItems } from '~/ui/sync-utils';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.unstage';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const data = await request.json();
  const keys = data.keys;
  invariant(Array.isArray(keys), 'Keys are required');
  const { syncItems } = await getSyncItems({ workspaceId });
  const status = await window.main.sync.status(syncItems);
  // Staging needs to happen since it creates blobs for the files
  const itemsToUnstage = keys
    .map(key => {
      if (typeof key === 'string') {
        const item = status.stage[key];
        return item;
      }

      return null;
    })
    .filter(isNotNullOrUndefined);

  await window.main.sync.unstage(itemsToUnstage);

  return null;
}

export const useInsomniaSyncUnstageActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      keys,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      keys: string[];
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/insomnia-sync/unstage',
        {
          organizationId,
          projectId,
          workspaceId,
        },
      );

      return submit(JSON.stringify({ keys }), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
