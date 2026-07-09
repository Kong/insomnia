import type { User, UserEncryptionKeys } from '@getinsomnia/insomnia-v3-fetch';

import { fetch } from './fetch';

export type { User, UserEncryptionKeys };

// POST /auth/logout
export const logout = ({ sessionId }: { sessionId: string }) => {
  return fetch({
    method: 'POST',
    path: '/auth/logout',
    sessionId,
  });
};

// GET /v3/users/me
export const getUserProfile = async ({ sessionId }: { sessionId: string }): Promise<User> => {
  return await fetch<User>({ method: 'GET', path: '/v3/users/me', sessionId });
};

// GET /v3/users/me/encryption-keys
export const getEncryptionKeys = async ({ sessionId }: { sessionId: string }): Promise<UserEncryptionKeys> => {
  return fetch<UserEncryptionKeys>({ method: 'GET', path: '/v3/users/me/encryption-keys', sessionId });
};

// Onboarding state for the current user. A standalone, removable resource (kept
// off the permanent users/me contract) that holds transient onboarding/experiment
// state with its own lifecycle. All fields are optional/backward-compatible.
export interface UserOnboardingState {
  // Server-computed first-request experiment treatment (the server is authoritative);
  // absent → the client falls back to the cached value / safe default.
  first_request_treatment?: 'A' | 'B';
  // Whether the account is a genuine new sign-up (an experiment participant).
  is_new_signup?: boolean;
  // Sticky, irreversible latch: the account has created at least the minimum number
  // of requests to graduate the first-request experiment (account-wide,
  // device-independent). Once true it never reverts.
  reached_request_threshold?: boolean;
}

// GET /v3/users/me/onboarding
export const getOnboardingState = async ({ sessionId }: { sessionId: string }): Promise<UserOnboardingState> => {
  return fetch<UserOnboardingState>({ method: 'GET', path: '/v3/users/me/onboarding', sessionId });
};

// PUT /v3/users/me/onboarding/request-threshold-reached
// Idempotent latch: PUTting this sub-resource marks that the account has reached the
// first-request graduation threshold. Idempotent by definition, so it's safe to call
// repeatedly — the server stores a sticky bit that never reverts and dropped calls
// self-heal on the next attempt. Returns the updated onboarding state.
export const latchRequestThresholdReached = async ({ sessionId }: { sessionId: string }): Promise<UserOnboardingState> => {
  return fetch<UserOnboardingState>({
    method: 'PUT',
    path: '/v3/users/me/onboarding/request-threshold-reached',
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
