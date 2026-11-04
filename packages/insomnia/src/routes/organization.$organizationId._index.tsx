import { redirect } from 'react-router';

import { getInitialRouteForOrganization } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId._index';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  return redirect(await getInitialRouteForOrganization({ organizationId: params.organizationId }));
}
