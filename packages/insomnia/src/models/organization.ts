interface Branding {
  logo_url: string;
}

export interface Metadata {
  organizationType: string;
  ownerAccountId: string;
  canGitSync: { enabled: true } | { enabled: false; reason: string };
  canRBAC: { enabled: true } | { enabled: false; reason: string };
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
