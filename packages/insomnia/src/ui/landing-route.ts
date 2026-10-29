import type { Organization } from 'insomnia-api';
import { models, services } from 'insomnia-data';

import { syncOrganizations } from '~/common/organization';
import { invariant } from '~/common/utils/invariant';
import { migrateKonnectProjectsIfUnambiguous } from '~/konnect/migrate-konnect-organization';
import {
  findMigrationTargetSpaceId,
  getKonnectOrganizationEscapeRoute,
  migrateProjectsUnderOrganization,
  refreshKonnectAccess,
} from '~/ui/organization-utils';
import { getInitialRouteForOrganization } from '~/ui/utils/router';

const readCachedOrganizations = (accountId: string) =>
  JSON.parse(localStorage.getItem(`${accountId}:spaces`) || '[]') as Organization[];

/**
 * Where to land when entering the given organization (`/organization/:organizationId`): escapes a
 * Konnect organization that just became invisible, otherwise picks the project — or, with
 * `navigateToWorkspace`, the workspace — from local data. Never waits for the network: the
 * organization's projects sync in the background once it is entered.
 */
export async function resolveOrganizationLandingRoute(
  organizationId: string,
  { navigateToWorkspace = false }: { navigateToWorkspace?: boolean } = {},
) {
  // Every "no reachable project in this organization" fallback lands here (deleting the last
  // Konnect project one at a time, or the bulk Disconnect action) — this is where it's decided
  // whether to land inside the organization normally or escape it because it just became invisible.
  const escapeRoute = await getKonnectOrganizationEscapeRoute(organizationId);
  return escapeRoute ?? (await getInitialRouteForOrganization({ organizationId, navigateToWorkspace }));
}

// Uses the cached organization list and only fetches it when there is none, since nothing could be
// picked without it; the organization layout refreshes it in the background either way. Then runs the account-wide migrations, which only touch local data: the landing
// depends on where they put the projects, and Konnect access is resolved after its migration so
// render-time readers of it can stay synchronous. The ambiguous Konnect migration is left for the
// organization layout to surface.
async function runAccountPreparation(sessionId: string, accountId: string) {
  if (!readCachedOrganizations(accountId).length) {
    await syncOrganizations(sessionId, accountId);
  }
  const organizations = readCachedOrganizations(accountId);
  invariant(organizations.length, 'Failed to fetch organizations. Check your network connection and try again.');

  // Failures are logged rather than thrown: a failed migration leaves the data as it was, which is
  // still usable, while throwing would keep every organization route behind the error boundary.
  try {
    await migrateKonnectProjectsIfUnambiguous(accountId);
  } catch (e) {
    console.log('[konnect] Failed to migrate Konnect projects', e);
  }
  try {
    await refreshKonnectAccess(sessionId, accountId);
  } catch (e) {
    console.log('[konnect] Failed to resolve Konnect access', e);
  }
  try {
    await migrateProjectsUnderOrganization(findMigrationTargetSpaceId(organizations), sessionId);
  } catch (e) {
    console.log('[organization] Failed to migrate projects into the organization', e);
  }
}

// The current session's run. Keyed by session, so every new session prepares again (signing in does
// not reload the renderer).
let accountPreparation: { sessionId: string; promise: Promise<void> } | null = null;

/**
 * Prepares the signed-in account once per session, before anything in an organization runs:
 * awaited by the organization layout's middleware, which every route inside an organization —
 * including `/organization` itself — passes through. Covers entries that skip `/organization`
 * too, such as deep links opened while the app is still on the onboarding or git migration screen.
 */
export async function prepareAccount() {
  const { id: sessionId, accountId } = await services.userSession.get();
  // Logged out (the scratchpad): there is no account to prepare.
  if (!sessionId) {
    return;
  }
  // Concurrent callers share the run.
  if (accountPreparation?.sessionId !== sessionId) {
    const promise = runAccountPreparation(sessionId, accountId).catch(error => {
      // A failed run is not kept, so the next request retries it.
      if (accountPreparation?.promise === promise) {
        accountPreparation = null;
      }
      throw error;
    });
    accountPreparation = { sessionId, promise };
  }
  await accountPreparation.promise;
}

/**
 * Where a signed-in user lands without a target organization (`/organization`): on launch, after
 * signing in, and every other "take me somewhere sensible" entry. The account is already prepared
 * by the organization layout's middleware (`prepareAccount`), so the cached organization list is
 * there and the projects are where they belong.
 */
export async function resolveLandingRoute(accountId: string) {
  const organizations = readCachedOrganizations(accountId);
  invariant(organizations.length, 'Failed to fetch organizations. Check your network connection and try again.');

  const specificOrgRedirectAfterAuthorize = window.localStorage.getItem('specificOrgRedirectAfterAuthorize');
  if (specificOrgRedirectAfterAuthorize) {
    window.localStorage.removeItem('specificOrgRedirectAfterAuthorize');
    return resolveOrganizationLandingRoute(specificOrgRedirectAfterAuthorize);
  }

  let organizationId = organizations[0].id;
  const lastVisitedOrganizationId = window.localStorage.getItem('lastVisitedOrganizationId');
  // The Konnect organization is local-only, so it is never in the cached organization list.
  const isKnownOrganization =
    lastVisitedOrganizationId === models.organization.getKonnectOrganizationId(accountId) ||
    organizations.some(o => o.id === lastVisitedOrganizationId);
  if (lastVisitedOrganizationId && isKnownOrganization) {
    organizationId = lastVisitedOrganizationId;
  }

  return resolveOrganizationLandingRoute(organizationId, { navigateToWorkspace: true });
}
