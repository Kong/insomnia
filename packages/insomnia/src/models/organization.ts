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
export const SCRATCHPAD_ORGANIZATION_ID = 'org_scratchpad';
export const isScratchpadOrganizationId = (organizationId: string) =>
  organizationId === SCRATCHPAD_ORGANIZATION_ID;
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
