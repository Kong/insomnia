import { href, redirect, useFetcher } from 'react-router';

import { logout } from '~/account/session';

import type { Route } from './+types/auth.logout';

export async function clientAction(_args: Route.ClientActionArgs) {
  await logout();
  return redirect(href('/auth/login'));
}

export function useLogoutFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientAction>(args);

  function submit() {
    return fetcher.submit({}, { action: href('/auth/logout'), method: 'POST' });
  }

  return {
    ...fetcher,
    submit,
  };
}
