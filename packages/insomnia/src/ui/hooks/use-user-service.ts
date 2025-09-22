import { useOrganizationLoaderData } from '~/routes/organization';
import { diffInDayCeil } from '~/utils';

export function useUserService() {
  const { currentPlan, user } = useOrganizationLoaderData()!;
  const isPro = currentPlan?.type === 'individual' || currentPlan?.type === 'team';
  const isEnterpriseOwner = currentPlan?.type === 'enterprise';
  const isEnterpriseMember = currentPlan?.type === 'enterprise-member';
  const isEssential = currentPlan?.type === 'free';
  const isEnterpriseLike = isEnterpriseOwner || isEnterpriseMember;
  const isTrailing = currentPlan?.status === 'trialing';
  const trialDaysLeft: number | null =
    isTrailing && currentPlan?.trialingEnd ? diffInDayCeil(new Date(currentPlan?.trialingEnd), new Date()) : null;
  return {
    isPro,
    isEnterpriseOwner,
    isEnterpriseMember,
    isEssential,
    isEnterpriseLike,
    canUpgrade: !isEnterpriseLike,
    displayName: user?.name || user?.email,
    isTrailing,
    trialDaysLeft,
  };
}
