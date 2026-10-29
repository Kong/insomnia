import { services } from 'insomnia-data';
import { redirect } from 'react-router';

import { resolveLandingRoute } from '~/ui/landing-route';

import type { Route } from './+types/organization._index';

// Signed in: the organization layout's middleware already sent a signed-out user to the login page.
export async function clientLoader(_args: Route.ClientLoaderArgs) {
  const { accountId } = await services.userSession.get();
  return redirect(await resolveLandingRoute(accountId));
}
