import type { Organization } from 'insomnia-api';
import { services } from 'insomnia-data';
import { href, redirect } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import * as session from '~/ui/account/session';
import { migrateProjectsUnderOrganization, syncOrganizations } from '~/ui/organization-utils';

import type { Route } from './+types/organization._index';

export async function clientLoader(_args: Route.ClientLoaderArgs) {
  const { id: sessionId, accountId } = await services.userSession.get();
  if (sessionId) {
    await syncOrganizations(sessionId, accountId);

    const organizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];
    invariant(organizations.length, 'Failed to fetch organizations. Check your network connection and try again.');

    const landingOrganizationId = organizations[0].id;
    // TODO: when migrating to /v3/users/me/spaces, target the owned space with total_members === 1
    // so legacy orphan local projects land in the user's solo space rather than a shared owned space.
    await migrateProjectsUnderOrganization(landingOrganizationId, sessionId);

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
