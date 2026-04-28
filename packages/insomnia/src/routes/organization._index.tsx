import type { Organization } from 'insomnia-api';
import { href, redirect } from 'react-router';

import * as session from '~/account/session';
import { services } from '~/insomnia-data';
import { findPersonalOrganization } from '~/models/organization';
import { migrateProjectsUnderOrganization, syncOrganizations } from '~/ui/organization-utils';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization._index';

export async function clientLoader(_args: Route.ClientLoaderArgs) {
  const { id: sessionId, accountId } = await services.userSession.getOrCreate();
  if (sessionId) {
    await syncOrganizations(sessionId, accountId);

    const organizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];
    invariant(organizations.length, 'Failed to fetch organizations. Check your network connection and try again.');

    const personalOrganization = findPersonalOrganization(organizations, accountId);
    invariant(
      personalOrganization,
      'Failed to find personal organization your account appears to be in an invalid state. Please contact support if this is a recurring issue.',
    );
    const personalOrganizationId = personalOrganization.id;
    await migrateProjectsUnderOrganization(personalOrganizationId, sessionId);

    const specificOrgRedirectAfterAuthorize = window.localStorage.getItem('specificOrgRedirectAfterAuthorize');
    if (specificOrgRedirectAfterAuthorize && specificOrgRedirectAfterAuthorize !== '') {
      window.localStorage.removeItem('specificOrgRedirectAfterAuthorize');
      return redirect(`/organization/${specificOrgRedirectAfterAuthorize}`);
    }

    if (personalOrganization) {
      return redirect(`/organization/${personalOrganizationId}`);
    }

    if (organizations.length > 0) {
      return redirect(`/organization/${organizations[0].id}`);
    }
  }

  await session.logout();
  return redirect(href('/auth/login'));
}
