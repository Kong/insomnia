import { href, redirect } from 'react-router';

import { logout } from '~/account/session';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/auth.logout';

export async function clientAction(_args: Route.ClientActionArgs) {
  await logout();
  return redirect(href('/auth/login'));
}

export const useLogoutFetcher = createFetcherSubmitHook(
  submit => () => {
    return submit({}, { action: href('/auth/logout'), method: 'POST' });
  },
  clientAction,
);
