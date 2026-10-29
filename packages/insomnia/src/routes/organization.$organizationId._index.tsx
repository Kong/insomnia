import { redirect } from 'react-router';

import { resolveOrganizationLandingRoute } from '~/ui/landing-route';

import type { Route } from './+types/organization.$organizationId._index';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  return redirect(await resolveOrganizationLandingRoute(params.organizationId));
}
