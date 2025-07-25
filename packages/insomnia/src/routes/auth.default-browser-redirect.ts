import { href, useFetcher } from 'react-router';

import type { Route } from './+types/auth.default-browser-redirect';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { redirectUrl } = (await request.json()) as { redirectUrl: string };
  window.main.onDefaultBrowserOAuthRedirect({
    url: redirectUrl,
  });

  return null;
}

export function useDefaultBrowserRedirectActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientAction>(args);
  function submit(data: { redirectUrl: string }) {
    return fetcher.submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/auth/default-browser-redirect'),
      encType: 'application/json',
    });
  }

  return {
    ...fetcher,
    submit,
  };
}
