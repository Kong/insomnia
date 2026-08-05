import { redirect } from 'react-router';

import { syncProjects } from '~/ui/organization-utils';
import { getInitialRouteForOrganization } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId._index';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId } = params;

  try {
    await syncProjects(organizationId);
  } catch {
    console.log('[project] Could not fetch remote projects.');
  }
  const initialOrganizationRoute = await getInitialRouteForOrganization({ organizationId });
  return redirect(initialOrganizationRoute);
}
