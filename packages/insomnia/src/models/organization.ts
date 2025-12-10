import { type PersonalPlanType } from 'insomnia-api';

interface Branding {
  logo_url: string;
}

export interface Metadata {
  organizationType: string;
  ownerAccountId: string;
}

export interface Organization {
  id: string;
  name: string;
  display_name: string;
  branding?: Branding;
  metadata: Metadata;
}

export interface StorageRules {
  enableCloudSync: boolean;
  enableLocalVault: boolean;
  enableGitSync: boolean;
  isOverridden: boolean;
}

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
export interface OrganizationsResponse {
  start: number;
  limit: number;
  length: number;
  total: number;
  next: string;
  organizations: Organization[];
}

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
