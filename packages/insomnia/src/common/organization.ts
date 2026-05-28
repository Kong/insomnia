import { getCurrentPlan, getUserProfile } from 'insomnia-api';

import { projectLock } from '~/common/project';
import { services } from '~/insomnia-data';
import { invariant } from '~/utils/invariant';

export { DEFAULT_STORAGE_RULES, fetchAndCacheOrganizationStorageRule } from '~/common/organization-storage-rules';

export async function syncOrganizations(sessionId: string, accountId: string) {
  try {
    const [organizations, user, currentPlan] = await Promise.all([
      services.organization.list(),
      getUserProfile({ sessionId }),
      getCurrentPlan({ sessionId }),
    ]);

    invariant(organizations, 'Failed to load organizations');
    invariant(user && user.id, 'Failed to load user');
    invariant(currentPlan && currentPlan.planId, 'Failed to load current plan');

    invariant(accountId, 'Account ID is not defined');

    localStorage.setItem(`${accountId}:organizations`, JSON.stringify(organizations));
    localStorage.setItem(`${accountId}:user`, JSON.stringify(user));
    localStorage.setItem(`${accountId}:currentPlan`, JSON.stringify(currentPlan));
  } catch (error) {
    console.log('[organization] Failed to load Organizations', error);
  }
}

export const syncProjects = projectLock.wrapWithLock(async (organizationId: string) => {
  await services.organization.syncProjectsOfOrg(organizationId);
});
