import { href, redirect, useFetcher } from 'react-router';

import { syncProjects } from '~/ui/organization-utils';
import { getInitialRouteForOrganization } from '~/utils/router';

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

export function useOrganizationIndexLoaderFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientLoader>(args);

  function load({ organizationId }: { organizationId: string }) {
    return fetcher.load(
      href('/organization/:organizationId', {
        organizationId,
      }),
    );
  }

  return {
    ...fetcher,
    load,
  };
}
