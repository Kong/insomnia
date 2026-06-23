import { type PersonalPlanType } from 'insomnia-api';
import { models } from 'insomnia-data';
import { useParams } from 'react-router';

import { useRootLoaderData } from '~/root';
import { useOrganizationLoaderData } from '~/routes/organization';

export const usePlanData = () => {
  let isOwner = false;
  let planType: PersonalPlanType = 'free';
  let planDisplayName = models.organization.formatCurrentPlanType(planType);
  let isFreePlan = true;
  let isTeamPlan = false;
  let isEnterprisePlan = false;
  const { userSession } = useRootLoaderData()!;
  const { organizationId } = useParams<{ organizationId: string }>();
  const organizationData = useOrganizationLoaderData();
  // ensure user has logged in with valid organization
  if (
    organizationData &&
    userSession &&
    Array.isArray(organizationData.organizations) &&
    organizationData.organizations.length > 0
  ) {
    const currentOrg = organizationData.organizations.find(organization => organization.id === organizationId);
    const accountId = userSession.accountId;
    if (currentOrg && accountId) {
      isOwner = models.organization.isOwnerOfOrganization({
        organization: currentOrg,
        accountId: userSession.accountId,
      });
    }
    planType = organizationData.currentPlan?.type || planType;
    isFreePlan = planType.includes('free');
    isTeamPlan = planType.includes('team');
    isEnterprisePlan = planType.includes('enterprise');
    planDisplayName = models.organization.formatCurrentPlanType(planType);
  }
  return {
    isOwner,
    currentPlan: organizationData?.currentPlan,
    planDisplayName,
    isFreePlan,
    isTeamPlan,
    isEnterprisePlan,
  };
};
