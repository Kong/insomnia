import { href } from 'react-router';

import { isNotNullOrUndefined } from '~/common/misc';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { getSyncItems } from '~/ui/sync-utils';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.stage';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const data = await request.json();
  const keys = data.keys;
  invariant(Array.isArray(keys), 'Keys are required');
  const { syncItems } = await getSyncItems({ workspaceId });
  const vcs = VCSInstance();
  const status = await vcs.status(syncItems);
  // Staging needs to happen since it creates blobs for the files
  const itemsToStage = keys
    .map(key => {
      if (typeof key === 'string') {
        const item = status.unstaged[key];
        return item;
      }

      return null;
    })
    .filter(isNotNullOrUndefined);

  await vcs.stage(itemsToStage);

  return null;
}

export const useInsomniaSyncStageActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      keys,
      organizationId,
      projectId,
      workspaceId,
    }: {
      keys: string[];
      organizationId: string;
      projectId: string;
      workspaceId: string;
    }) => {
      return submit(JSON.stringify({ keys }), {
        method: 'POST',
        action: href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId/insomnia-sync/stage`, {
          organizationId,
          projectId,
          workspaceId,
        }),
        encType: 'application/json',
      });
    },
  clientAction,
);
