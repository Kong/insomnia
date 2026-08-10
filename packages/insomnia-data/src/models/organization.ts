import type { Organization, PersonalPlanType } from 'insomnia-api';

export const SCRATCHPAD_ORGANIZATION_ID = 'org_scratchpad';
export const isScratchpadOrganizationId = (organizationId: string) => organizationId === SCRATCHPAD_ORGANIZATION_ID;

export const KONNECT_ORGANIZATION_ID_PREFIX = 'org_konnect_';
export const KONNECT_ORGANIZATION_NAME = 'Control Planes';

// The Konnect organization is local-only, but the database is not partitioned per user, so the
// account id is baked into the id to keep one account's Konnect data out of another's.
export const getKonnectOrganizationId = (accountId: string) => `${KONNECT_ORGANIZATION_ID_PREFIX}${accountId}`;
export const isKonnectOrganizationId = (organizationId: string) =>
  organizationId.startsWith(KONNECT_ORGANIZATION_ID_PREFIX);

/** Organizations that exist only on this machine and must never be used for organization-scoped API calls. */
export const isLocalOrganizationId = (organizationId: string) =>
  isScratchpadOrganizationId(organizationId) || isKonnectOrganizationId(organizationId);

export const buildKonnectOrganization = (accountId: string): Organization => ({
  id: getKonnectOrganizationId(accountId),
  name: KONNECT_ORGANIZATION_NAME,
  picture: null,
  owner_first_name: null,
  owner_last_name: null,
  owner_email: null,
  total_members: 1,
  total_invites: 0,
  // Every account owns at least one organization, and this one only exists on their machine.
  is_owner: true,
  can_leave: false,
});

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
