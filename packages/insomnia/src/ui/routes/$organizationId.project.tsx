import { type LoaderFunction, redirect } from 'react-router';

import { invariant } from '../../utils/invariant';
import { getInitialRouteForOrganization } from '../../utils/router';
import { syncProjects } from './$organizationId.project.$projectId';

export const indexLoader: LoaderFunction = async ({ params }) => {
  const { organizationId } = params;
  invariant(organizationId, 'Organization ID is required');

  try {
    await syncProjects(organizationId);
  } catch {
    console.log('[project] Could not fetch remote projects.');
  }
  const initialOrganizationRoute = await getInitialRouteForOrganization({ organizationId });
  return redirect(initialOrganizationRoute);
};
