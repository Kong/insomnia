import { href } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import uiEventBus, { CLOUD_SYNC_FILE_CHANGE } from '~/ui/event-bus';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.insomnia-sync.delete-remote-file';

export async function clientAction({ request }: Route.ClientActionArgs) {
  try {
    const formData = await request.formData();

    const backendProjectId = formData.get('backendProjectId');
    invariant(typeof backendProjectId === 'string', 'Backend project Id is required');

    await window.main.sync.archiveBackendProject(backendProjectId);
    uiEventBus.emit(CLOUD_SYNC_FILE_CHANGE);

    return { error: null };
  } catch (e) {
    console.warn('Failed to delete remote file', e);
    return {
      error: e instanceof Error ? e.message : 'Failed to delete remote file',
    };
  }
}

export const useInsomniaSyncDeleteRemoteFileActionFetcher = createFetcherSubmitHook(
  submit =>
    ({ organizationId, backendProjectId }: { organizationId: string; backendProjectId: string }) => {
      const url = href('/organization/:organizationId/insomnia-sync/delete-remote-file', {
        organizationId,
      });

      const formData = new FormData();
      formData.set('backendProjectId', backendProjectId);

      return submit(formData, {
        action: url,
        method: 'POST',
      });
    },
  clientAction,
);
