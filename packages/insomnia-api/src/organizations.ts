import { fetch } from './fetch';

interface Branding {
  logo_url: string;
}

export type OrganizationType = 'personal' | 'team' | 'enterprise';

export interface OrganizationMetadata {
  organizationType: OrganizationType;
  ownerAccountId: string;
  description?: string;
}

export interface Organization {
  id: string;
  name: string;
  display_name: string;
  branding?: Branding;
  metadata: OrganizationMetadata;
}

export interface OrganizationsResponse {
  start: number;
  limit: number;
  length: number;
  total: number;
  next: string;
  organizations: Organization[];
}

export const getOrganizations = ({ sessionId }: { sessionId: string }) => {
  return fetch<OrganizationsResponse>({
    method: 'GET',
    path: '/v1/organizations',
    sessionId,
  });
};

export const needsToUpgrade = 'NEEDS_TO_UPGRADE';
export const needsToIncreaseSeats = 'NEEDS_TO_INCREASE_SEATS';

export interface CheckSeatsResponse {
  isAllowed: boolean;
  code?: typeof needsToUpgrade | typeof needsToIncreaseSeats;
}

export const checkSeats = ({
  organizationId,
  sessionId,
  emails,
}: {
  organizationId: string;
  sessionId: string;
  emails: string[];
}) => {
  return fetch<CheckSeatsResponse>({
    method: 'POST',
    path: `/v1/organizations/${organizationId}/check-seats`,
    data: { emails },
    sessionId,
  });
};

export interface Role {
  id: string;
  name: string;
  description?: string;
}

export const getOrganizationRoles = ({ sessionId }: { sessionId: string }) => {
  return fetch<Role[]>({
    method: 'GET',
    path: `/v1/organizations/roles`,
    sessionId,
  });
};

export interface FeatureStatus {
  enabled: boolean;
  reason?: string;
}

export interface FeatureList {
  bulkImport: FeatureStatus;
  gitSync: FeatureStatus;
  orgBasicRbac: FeatureStatus;
  aiMockServers: FeatureStatus;
  aiCommitMessages: FeatureStatus;
  aiMcpClient: FeatureStatus;
}

export interface Billing {
  // If true, the user has paid for the current period
  isActive: boolean;
  expirationWarningMessage: string;
  expirationErrorMessage: string;
  accessDenied: boolean;
}

export const getOrganizationFeatures = ({
  organizationId,
  sessionId,
}: {
  organizationId: string;
  sessionId: string;
}) => {
  return fetch<{ features: FeatureList; billing: Billing }>({
    method: 'GET',
    path: `/v1/organizations/${organizationId}/features`,
    sessionId,
  });
};

export interface StorageRules {
  enableCloudSync: boolean;
  enableLocalVault: boolean;
  enableGitSync: boolean;
  isOverridden: boolean;
}

export const getOrganizationStorageRule = ({
  organizationId,
  sessionId,
}: {
  organizationId: string;
  sessionId: string;
}) => {
  return fetch<StorageRules>({
    method: 'GET',
    path: `/v1/organizations/${organizationId}/storage-rule`,
    sessionId,
  });
};

export type Permission =
  | 'own:organization'
  | 'read:organization'
  | 'delete:organization'
  | 'update:organization'
  | 'read:membership'
  | 'delete:membership'
  | 'update:membership'
  | 'read:invitation'
  | 'create:invitation'
  | 'delete:invitation'
  | 'create:enterprise_connection'
  | 'read:enterprise_connection'
  | 'delete:enterprise_connection'
  | 'update:enterprise_connection'
  | 'leave:organization';

export const getOrgUserPermissions = ({ organizationId, sessionId }: { organizationId: string; sessionId: string }) => {
  return fetch<Record<Permission, boolean>>({
    method: 'GET',
    path: `/v1/organizations/${organizationId}/user-permissions`,
    sessionId,
  });
};

export const deleteOrganizationMember = ({
  organizationId,
  userId,
  sessionId,
}: {
  organizationId: string;
  userId: string;
  sessionId: string;
}) => {
  return fetch({
    method: 'DELETE',
    path: `/v1/organizations/${organizationId}/members/${userId}`,
    sessionId,
  });
};

export const updateUserRoles = ({
  organizationId,
  userId,
  roleId,
  sessionId,
}: {
  organizationId: string;
  userId: string;
  roleId: string;
  sessionId: string;
}) => {
  return fetch({
    method: 'PATCH',
    path: `/v1/organizations/${organizationId}/members/${userId}/roles`,
    data: {
      roles: [roleId],
    },
    sessionId,
  });
};

export const getOrganizationMemberRoles = ({
  organizationId,
  userId,
  sessionId,
}: {
  organizationId: string;
  userId: string;
  sessionId: string;
}) => {
  return fetch<Role>({
    method: 'GET',
    path: `/v1/organizations/${organizationId}/members/${userId}/roles`,
    sessionId,
  });
};

export const getOrganizationDetail = ({ organizationId, sessionId }: { organizationId: string; sessionId: string }) => {
  return fetch<Organization>({
    method: 'GET',
    path: `/v1/organizations/${organizationId}`,
    sessionId,
  });
};
