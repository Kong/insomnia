import { type LoaderFunctionArgs, redirect } from 'react-router';

import * as session from '../../account/session';
import { userSession } from '../../models';
import { findPersonalOrganization, type Organization } from '../../models/organization';
import { invariant } from '../../utils/invariant';
import { migrateProjectsUnderOrganization, syncOrganizations } from '../organization-utils';

export async function loader(_args: LoaderFunctionArgs) {
  const { id: sessionId, accountId } = await userSession.getOrCreate();
  if (sessionId) {
    await syncOrganizations(sessionId, accountId);

    const organizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];
    invariant(organizations, 'Failed to fetch organizations.');

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
  return redirect('/auth/login');
}
