import { href, redirect } from 'react-router';

import { logout } from '~/account/session';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/auth.logout';

interface LogoutData {
  clearCredentials?: boolean;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = (await request.json()) as LogoutData;
  await logout(data.clearCredentials ?? false);
  return redirect(href('/auth/login'));
}

export const useLogoutFetcher = createFetcherSubmitHook(
  submit =>
    (data: LogoutData = {}) => {
      return submit(JSON.stringify(data), {
        action: href('/auth/logout'),
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
