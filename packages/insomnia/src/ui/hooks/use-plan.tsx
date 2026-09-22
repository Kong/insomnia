import { type PersonalPlanType } from 'insomnia-api';
import { models } from 'insomnia-data';
import { useParams } from 'react-router';

import { useRootLoaderData } from '~/root';
import { useCurrentPlan, useOrganizations } from '~/ui/hooks/use-account-server-data';

export const usePlanData = () => {
  let isOwner = false;
  let planType: PersonalPlanType = 'free';
  let planDisplayName = models.organization.formatCurrentPlanType(planType);
  let isFreePlan = true;
  let isTeamPlan = false;
  let isEnterprisePlan = false;
  const { userSession } = useRootLoaderData()!;
  const { organizationId } = useParams<{ organizationId: string }>();
  const organizations = useOrganizations();
  const currentPlan = useCurrentPlan();
  // ensure user has logged in with valid organization
  if (userSession && Array.isArray(organizations) && organizations.length > 0) {
    const currentOrg = organizations.find(organization => organization.id === organizationId);
    if (currentOrg && userSession.accountId) {
      isOwner = Boolean(currentOrg.is_owner);
    }
    planType = currentPlan?.type || planType;
    isFreePlan = planType.includes('free');
    isTeamPlan = planType.includes('team');
    isEnterprisePlan = planType.includes('enterprise');
    planDisplayName = models.organization.formatCurrentPlanType(planType);
  }
  return {
    isOwner,
    currentPlan,
    planDisplayName,
    isFreePlan,
    isTeamPlan,
    isEnterprisePlan,
  };
};
