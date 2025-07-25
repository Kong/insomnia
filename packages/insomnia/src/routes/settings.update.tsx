import { useFetcher } from 'react-router';

import * as models from '~/models';
import { SegmentEvent } from '~/ui/analytics';

import type { Route } from './+types/settings.update';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const patch = await request.json();
  if ('enableAnalytics' in patch && !patch.enableAnalytics) {
    window.main.trackSegmentEvent({ event: SegmentEvent.analyticsDisabled });
  }
  await models.settings.patch(patch);
  return null;
}

export function useSettingsUpdateActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientAction>(args);

  function submit(patch: any) {
    return fetcher.submit(patch, {
      method: 'POST',
      action: '/settings/update',
      encType: 'application/json',
    });
  }

  return {
    ...fetcher,
    submit,
  };
}
