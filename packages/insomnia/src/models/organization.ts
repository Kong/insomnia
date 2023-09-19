interface Branding {
  logo_url: string;
}

export const featureMetadataDefaultValue = '{ "enabled": false, "reason": "original feature value is undefined" }';

export interface Metadata {
  organizationType: string;
  ownerAccountId: string;
  canGitSync: string;
  canRBAC: string;
}

export interface FeatureMetadata {
  enabled: boolean;
  reason?: string;
}

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
