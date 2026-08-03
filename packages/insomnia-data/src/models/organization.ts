import type { PersonalPlanType } from 'insomnia-api';

export const SCRATCHPAD_ORGANIZATION_ID = 'org_scratchpad';
export const DEV_PORTAL_ORGANIZATION_ID = 'org_dev_portal';

export const isScratchpadOrganizationId = (organizationId: string) => organizationId === SCRATCHPAD_ORGANIZATION_ID;
export const isDevPortalOrganizationId = (organizationId: string) => organizationId === DEV_PORTAL_ORGANIZATION_ID;

export const isLocalOrganizationId = (organizationId: string) =>
  isScratchpadOrganizationId(organizationId) || isDevPortalOrganizationId(organizationId);

export const formatCurrentPlanType = (type: PersonalPlanType) => {
  switch (type) {
    case 'free': {
      return 'Essentials';
    }
    case 'individual': {
      return 'Individual';
    }
    case 'team': {
      return 'Pro';
    }
    case 'enterprise': {
      return 'Enterprise';
    }
    case 'enterprise-member': {
      return 'Enterprise';
    }
    default: {
      return 'Free';
    }
  }
};
