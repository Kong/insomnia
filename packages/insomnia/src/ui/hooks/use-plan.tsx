import { useParams } from 'react-router';

import { isOwnerOfOrganization } from '../../models/organization';
import { formatCurrentPlanType, type PersonalPlanType } from '../organization-utils';
import { useOrganizationLoaderData } from '../routes/organization';
import { useRootLoaderData } from '../routes/root';

export const usePlanData = () => {
  let isOwner = false;
  let planType: PersonalPlanType = 'free';
  let planDisplayName = formatCurrentPlanType(planType);
  let isFreePlan = true;
  let isTeamPlan = false;
  let isEnterprisePlan = false;
  const { userSession } = useRootLoaderData();
  const { organizationId } = useParams<{ organizationId: string }>();
  const { currentPlan, organizations } = useOrganizationLoaderData();
  // ensure user has logged in with valid organization
  if (userSession && Array.isArray(organizations) && organizations.length > 0) {
    const currentOrg = organizations.find(organization => organization.id === organizationId);
    const accountId = userSession.accountId;
    if (currentOrg && accountId) {
      isOwner = isOwnerOfOrganization({
        organization: currentOrg,
        accountId: userSession.accountId,
      });
    }
    planType = currentPlan?.type || planType;
    isFreePlan = planType.includes('free');
    isTeamPlan = planType.includes('team');
    isEnterprisePlan = planType.includes('enterprise');
    planDisplayName = formatCurrentPlanType(planType);
  }
  return { isOwner, currentPlan, planDisplayName, isFreePlan, isTeamPlan, isEnterprisePlan };
};
