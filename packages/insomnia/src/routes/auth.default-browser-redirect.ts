import { href } from 'react-router';

import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/auth.default-browser-redirect';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { redirectUrl } = (await request.json()) as { redirectUrl: string };
  window.main.onDefaultBrowserOAuthRedirect({
    url: redirectUrl,
  });

  return null;
}

export const useDefaultBrowserRedirectActionFetcher = createFetcherSubmitHook(
  submit => (data: { redirectUrl: string }) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/auth/default-browser-redirect'),
      encType: 'application/json',
    });
  },
  clientAction,
);
