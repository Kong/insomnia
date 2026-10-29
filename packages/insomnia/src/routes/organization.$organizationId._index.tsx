import { redirect } from 'react-router';

import { getKonnectOrganizationEscapeRoute } from '~/ui/organization-utils';
import { getInitialRouteForOrganization } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId._index';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId } = params;

  // Every "no reachable project in this organization" fallback redirects here (deleting the last
  // Konnect project one at a time, or the bulk Disconnect action) — this is where it's decided
  // whether to land inside the organization normally or escape it because it just became invisible.
  const escapeRoute = await getKonnectOrganizationEscapeRoute(organizationId);
  if (escapeRoute) {
    return redirect(escapeRoute);
  }

  // Lands with local data: the organization's projects sync in the background once it is entered,
  // and the empty project view waits for that sync.
  const initialOrganizationRoute = await getInitialRouteForOrganization({ organizationId });
  return redirect(initialOrganizationRoute);
}
