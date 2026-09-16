import { redirect } from 'react-router';

import { syncProjects } from '~/common/project';
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

  try {
    await syncProjects(organizationId);
  } catch {
    console.log('[project] Could not fetch remote projects.');
  }
  const initialOrganizationRoute = await getInitialRouteForOrganization({ organizationId });
  return redirect(initialOrganizationRoute);
}
