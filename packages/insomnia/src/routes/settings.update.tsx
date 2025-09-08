import * as models from '~/models';
import type { Settings } from '~/models/settings';
import { SegmentEvent } from '~/ui/analytics';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/settings.update';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const patch = (await request.json()) as Partial<Settings>;
  if ('enableAnalytics' in patch && !patch.enableAnalytics) {
    window.main.trackSegmentEvent({ event: SegmentEvent.analyticsDisabled });
  }
  await models.settings.patch(patch);
  return null;
}

export const useSettingsUpdateActionFetcher = createFetcherSubmitHook(
  submit =>
    ({ patch }: { patch: Partial<Settings> }) => {
      return submit(JSON.stringify(patch), {
        method: 'POST',
        action: '/settings/update',
        encType: 'application/json',
      });
    },
  clientAction,
);
