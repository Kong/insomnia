import { services } from 'insomnia-data';
import { href, redirect } from 'react-router';

import * as session from '~/ui/account/session';
import { resolveLandingRoute } from '~/ui/landing-route';

import type { Route } from './+types/organization._index';

export async function clientLoader(_args: Route.ClientLoaderArgs) {
  const { id: sessionId, accountId } = await services.userSession.get();
  if (sessionId) {
    return redirect(await resolveLandingRoute(accountId));
  }

  await session.logout();
  return redirect(href('/auth/login'));
}
