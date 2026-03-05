import { type Organization, type PersonalPlanType } from 'insomnia-api';

export const SCRATCHPAD_ORGANIZATION_ID = 'org_scratchpad';
export const isScratchpadOrganizationId = (organizationId: string) => organizationId === SCRATCHPAD_ORGANIZATION_ID;
export const isPersonalOrganization = (organization: Organization) =>
  organization.metadata.organizationType === 'personal';

export const isOwnerOfOrganization = ({ organization, accountId }: { organization: Organization; accountId: string }) =>
  organization.metadata.ownerAccountId === accountId;

export const findPersonalOrganization = (organizations: Organization[], accountId: string) => {
  return organizations.filter(isPersonalOrganization).find(organization =>
    isOwnerOfOrganization({
      organization,
      accountId,
    }),
  );
};

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
