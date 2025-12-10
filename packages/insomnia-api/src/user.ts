import { fetch } from './fetch';

// POST /auth/logout
export const logout = ({ sessionId }: { sessionId: string }) => {
  return fetch({
    method: 'POST',
    path: '/auth/logout',
    sessionId,
  });
};

// GET /auth/whoami
interface WhoamiResponse {
  sessionAge: number;
  sessionExpiry: number;
  accountId: string;
  email: string;
  firstName: string;
  lastName: string;
  created: number;
  publicKey: string;
  encSymmetricKey: string;
  encPrivateKey: string;
  saltEnc: string;
  isPaymentRequired: boolean;
  isTrialing: boolean;
  isVerified: boolean;
  isAdmin: boolean;
  trialEnd: string;
  planName: string;
  planId: string;
  canManageTeams: boolean;
  maxTeamMembers: number;
}

export const whoami = async ({ sessionId }: { sessionId: string }): Promise<WhoamiResponse> => {
  const response = await fetch<WhoamiResponse>({
    method: 'GET',
    path: '/auth/whoami',
    sessionId,
  });
  if (typeof response === 'string') {
    throw new TypeError('Unexpected plaintext response: ' + response);
  }
  if (response && !response?.encSymmetricKey) {
    throw new Error('Unexpected response: ' + JSON.stringify(response));
  }
  return response;
};

// GET /v1/user/profile
export interface UserProfile {
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

export const getUserProfile = async ({ sessionId }: { sessionId: string }) => {
  return fetch<UserProfile>({
    method: 'GET',
    path: '/v1/user/profile',
    sessionId,
  });
};

// GET /v1/billing/current-plan
export type PersonalPlanType = 'free' | 'individual' | 'team' | 'enterprise' | 'enterprise-member';
type PaymentSchedules = 'month' | 'year';
export interface CurrentPlan {
  isActive: boolean;
  period: PaymentSchedules;
  planId: string;
  price: number;
  quantity: number;
  type: PersonalPlanType;
  planName: string;
  status: 'trialing' | 'active';
  trialingEnd: string;
}

export const getCurrentPlan = async ({ sessionId }: { sessionId: string }) => {
  return fetch<CurrentPlan>({
    method: 'GET',
    path: '/v1/billing/current-plan',
    sessionId,
  });
};

// GET /v1/user/files
export interface RemoteFile {
  id: string;
  name: string;
  organizationId: string;
  teamProjectId: string;
  projectId: string;
}

export const getUserFiles = async ({ sessionId }: { sessionId: string }) => {
  return fetch<RemoteFile[]>({
    method: 'GET',
    path: '/v1/user/files',
    sessionId,
  });
};

// GET learning feature
export interface LearningFeature {
  active: boolean;
  title: string;
  message: string;
  cta: string;
  url: string;
}

export const getLearningFeature = async (): Promise<LearningFeature> => {
  return fetch<LearningFeature>({
    method: 'GET',
    path: '/insomnia-production-public-assets/inapp-learning.json',
    origin: 'https://storage.googleapis.com',
    // This is not an Insomnia API endpoint and does not require a sessionId
    sessionId: '',
  });
};
