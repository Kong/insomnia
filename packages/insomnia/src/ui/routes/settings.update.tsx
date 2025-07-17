import { type ActionFunctionArgs } from 'react-router';

import * as models from '../../models';
import { SegmentEvent } from '../analytics';

export async function action({ request }: ActionFunctionArgs) {
  const patch = await request.json();
  if ('enableAnalytics' in patch && !patch.enableAnalytics) {
    window.main.trackSegmentEvent({ event: SegmentEvent.analyticsDisabled });
  }
  await models.settings.patch(patch);
  return null;
}
