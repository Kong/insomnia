import { href } from 'react-router';

import type { DefaultBrowserRedirectParam } from '~/common/misc';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/auth.default-browser-redirect';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const param = (await request.json()) as DefaultBrowserRedirectParam;
  window.main.onDefaultBrowserOAuthRedirect(param);

  return null;
}

export const useDefaultBrowserRedirectActionFetcher = createFetcherSubmitHook(
  submit => (data: DefaultBrowserRedirectParam) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/auth/default-browser-redirect'),
      encType: 'application/json',
    });
  },
  clientAction,
);
