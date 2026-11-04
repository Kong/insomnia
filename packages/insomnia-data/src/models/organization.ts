export interface Organization {
  id: string;
  name: string;
}

export const LOCAL_ORGANIZATION_ID = 'org_local';
export const LOCAL_ORGANIZATION: Organization = { id: LOCAL_ORGANIZATION_ID, name: 'Local' };

// Everything lives on this machine, so every organization is local.
export const isLocalOrganizationId = (_organizationId: string) => true;
