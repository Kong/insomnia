import { getCurrentPlan, getUserProfile } from 'insomnia-api';
import { services } from 'insomnia-data';

import { invariant } from '~/common/utils/invariant';

// This is reusable action/loader implementations.
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

    localStorage.setItem(`${accountId}:spaces`, JSON.stringify(organizations));
    localStorage.setItem(`${accountId}:user`, JSON.stringify(user));
    localStorage.setItem(`${accountId}:currentPlan`, JSON.stringify(currentPlan));
  } catch (error) {
    console.log('[organization] Failed to load Organizations', error);
  }
}
