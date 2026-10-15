import type { Organization } from 'insomnia-api';
import { services } from 'insomnia-data';
import { href, redirect } from 'react-router';

import { syncOrganizations } from '~/common/organization';
import { invariant } from '~/common/utils/invariant';
import { migrateKonnectProjectsIfUnambiguous } from '~/konnect/migrate-konnect-organization';
import * as session from '~/ui/account/session';
import {
  findMigrationTargetSpaceId,
  migrateProjectsUnderOrganization,
  refreshKonnectAccess,
} from '~/ui/organization-utils';

import type { Route } from './+types/organization._index';

export async function clientLoader(_args: Route.ClientLoaderArgs) {
  const { id: sessionId, accountId } = await services.userSession.get();
  if (sessionId) {
    await syncOrganizations(sessionId, accountId);
    // Signing in does not reload the renderer, so the startup resolution in `entry.client.tsx` ran
    // against the previous (logged-out) session — it had no account to migrate Konnect projects or
    // resolve entitlements for. Run the unambiguous Konnect migration here instead, now that
    // `${accountId}:spaces` is freshly synced above; a genuine conflict is still left for the modal
    // in `organization.tsx` to surface after hydration.
    await migrateKonnectProjectsIfUnambiguous(accountId);
    await refreshKonnectAccess(sessionId, accountId);

    const organizations = JSON.parse(localStorage.getItem(`${accountId}:spaces`) || '[]') as Organization[];
    invariant(organizations.length, 'Failed to fetch organizations. Check your network connection and try again.');

    const landingOrganizationId = organizations[0].id;
    await migrateProjectsUnderOrganization(findMigrationTargetSpaceId(organizations), sessionId);

    const specificOrgRedirectAfterAuthorize = window.localStorage.getItem('specificOrgRedirectAfterAuthorize');
    if (specificOrgRedirectAfterAuthorize && specificOrgRedirectAfterAuthorize !== '') {
      window.localStorage.removeItem('specificOrgRedirectAfterAuthorize');
      return redirect(`/organization/${specificOrgRedirectAfterAuthorize}`);
    }

    return redirect(`/organization/${landingOrganizationId}`);
  }

  await session.logout();
  return redirect(href('/auth/login'));
}
