import { useParams, useRouteLoaderData } from 'react-router-dom';

import { isOwnerOfOrganization } from '../../models/organization';
import { formatCurrentPlanType, type OrganizationLoaderData } from '../routes/organization';
import { useRootLoaderData } from '../routes/root';

export const usePlanData = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { currentPlan, organizations } = useRouteLoaderData('/organization') as OrganizationLoaderData;
  const { userSession } = useRootLoaderData();
  const currentOrg = organizations.find(organization => (organization.id === organizationId));
  const accountId = userSession.accountId;
  let isOwner = false;
  if (currentOrg && accountId) {
    isOwner = isOwnerOfOrganization({
      organization: currentOrg,
      accountId: userSession.accountId,
    });
  }
  const planType = currentPlan?.type || 'free';
  const isFreePlan = planType.includes('free');
  const isTeamPlan = planType.includes('team');
  const isEnterprisePlan = planType.includes('enterprise');
  const planDisplayName = formatCurrentPlanType(planType);

  return { isOwner, currentPlan, planDisplayName, isFreePlan, isTeamPlan, isEnterprisePlan };
};
