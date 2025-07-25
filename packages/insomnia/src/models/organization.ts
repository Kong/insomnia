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

export interface UserProfileResponse {
  id: string;
  email: string;
  name: string;
  picture: string;
  bio: string;
  github: string;
  linkedin: string;
  twitter: string;
  identities: any;
  given_name: string;
  family_name: string;
}

export type PersonalPlanType = 'free' | 'individual' | 'team' | 'enterprise' | 'enterprise-member';
export const formatCurrentPlanType = (type: PersonalPlanType) => {
  switch (type) {
    case 'free': {
      return 'Hobby';
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
      return 'Enterprise Member';
    }
    default: {
      return 'Free';
    }
  }
};
type PaymentSchedules = 'month' | 'year';

export interface CurrentPlan {
  isActive: boolean;
  period: PaymentSchedules;
  planId: string;
  price: number;
  quantity: number;
  type: PersonalPlanType;
  planName: string;
}
