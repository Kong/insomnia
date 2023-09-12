interface Branding {
  logo_url: string;
}

export interface Metadata {
  organizationType: string;
  ownerAccountId: string;
  canGitSync: string;
  canRBAC: string;
}

// FeatureFlagInfo is the structure of canGitSync and canRBAC string value.
export interface FeatureFlagInfo {
  enabled: boolean;
  reason: string;
};

export interface Organization {
  id: string;
  name: string;
  display_name: string;
  branding?: Branding;
  metadata: Metadata;
}

export const isPersonalOrganization = (organization: Organization) =>
  organization.metadata.organizationType === 'personal';

export const isOwnerOfOrganization = ({
  organization,
  accountId,
}: {
  organization: Organization;
  accountId: string;
}) =>
  organization.metadata.ownerAccountId === accountId;
