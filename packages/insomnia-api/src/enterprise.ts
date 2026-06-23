import { fetch } from './fetch';

// GET /v1/user/resource-usage
interface ResourceUsage {
  mocks: {
    quota: number;
    calls: number;
    autoPurchase: {
      enabled: boolean;
      unit: number;
    };
  };
}

export const getResourceUsage = ({ sessionId }: { sessionId: string }) => {
  return fetch<ResourceUsage>({
    method: 'GET',
    path: '/v1/user/resource-usage',
    sessionId,
  });
};

// GET /v1/user/enterprises
interface EnterpriseOwner {
  id: string;
  name: string;
  role: string;
}

export const getOwnEnterprises = ({ sessionId }: { sessionId: string }) => {
  return fetch<EnterpriseOwner[]>({
    method: 'GET',
    path: '/v1/user/enterprises',
    sessionId,
  });
};

// GET /v1/accounts/seats
interface AccountUsedSeats {
  memberCount: number;
  inviteCount: number;
  used: number;
  total: number;
}

export const getAccountUsedSeats = ({ sessionId }: { sessionId: string }) => {
  return fetch<AccountUsedSeats>({
    method: 'GET',
    path: '/v1/accounts/seats',
    sessionId,
  });
};

// GET /v1/enterprise/:enterpriseId/license-usage
interface LicenseUsage {
  used: number;
  total: number;
  memberCount: number;
  inviteCount: number;
  free: number;
}

export const getEnterpriseLicenseUsage = ({ sessionId, enterpriseId }: { sessionId: string; enterpriseId: string }) => {
  return fetch<LicenseUsage>({
    method: 'GET',
    path: `/v1/enterprise/${enterpriseId}/license-usage`,
    sessionId,
  });
};
