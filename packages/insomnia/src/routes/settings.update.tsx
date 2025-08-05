import { useCallback } from 'react';
import { useFetcher } from 'react-router';

import * as models from '~/models';
import type { Settings } from '~/models/settings';
import { SegmentEvent } from '~/ui/analytics';

import type { Route } from './+types/settings.update';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const patch = (await request.json()) as Partial<Settings>;
  if ('enableAnalytics' in patch && !patch.enableAnalytics) {
    window.main.trackSegmentEvent({ event: SegmentEvent.analyticsDisabled });
  }
  await models.settings.patch(patch);
  return null;
}

export function useSettingsUpdateActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({ patch }: { patch: Partial<Settings> }) => {
      return fetcherSubmit(JSON.stringify(patch), {
        method: 'POST',
        action: '/settings/update',
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
