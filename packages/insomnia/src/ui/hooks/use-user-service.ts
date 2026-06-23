import { useOrganizationLoaderData } from '~/routes/organization';
import { diffInDayCeil } from '~/ui/utils';

export function useUserService() {
  const { currentPlan, user } = useOrganizationLoaderData()!;
  const isPro = currentPlan?.type === 'individual' || currentPlan?.type === 'team';
  const isEnterpriseOwner = currentPlan?.type === 'enterprise';
  const isEnterpriseMember = currentPlan?.type === 'enterprise-member';
  const isEssential = currentPlan?.type === 'free';
  const isEnterpriseLike = isEnterpriseOwner || isEnterpriseMember;
  const isTrailing = currentPlan?.status === 'trialing';
  const isPaidEnterprise = isEnterpriseLike && !isTrailing;
  const trialDaysLeft: number | null =
    isTrailing && currentPlan?.trialingEnd ? diffInDayCeil(new Date(currentPlan?.trialingEnd), new Date()) : null;
  return {
    isPro,
    isEnterpriseOwner,
    isEnterpriseMember,
    isEssential,
    isEnterpriseLike,
    isPaidEnterprise,
    canUpgrade: !isEnterpriseLike,
    displayName: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email,
    isTrailing,
    trialDaysLeft,
  };
}
