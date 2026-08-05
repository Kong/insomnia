import type { User, UserEncryptionKeys, UserOnboarding } from '@getinsomnia/insomnia-v3-fetch';
import { UserOnboardingFirstRequestTreatmentEnum } from '@getinsomnia/insomnia-v3-fetch';

import { fetch } from './fetch';

export type { User, UserEncryptionKeys, UserOnboarding };
export { UserOnboardingFirstRequestTreatmentEnum };

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

// GET /v3/users/me/onboarding
export const getOnboardingState = async ({ sessionId }: { sessionId: string }): Promise<UserOnboarding> => {
  return fetch<UserOnboarding>({ method: 'GET', path: '/v3/users/me/onboarding', sessionId });
};

// POST /v3/users/me/onboarding/request-threshold
// Idempotent latch: POSTing this sub-resource marks that the account has reached the
// first-request graduation threshold. Idempotent by definition, so it's safe to call
// repeatedly — the server stores a sticky bit that never reverts and dropped calls
// self-heal on the next attempt. Responds 204 with no body.
export const latchRequestThresholdReached = async ({ sessionId }: { sessionId: string }): Promise<void> => {
  return fetch<void>({
    method: 'POST',
    path: '/v3/users/me/onboarding/request-threshold',
    sessionId,
  });
};

// POST /v3/users/me/actions
export type UserActionType = 'request_created' | 'request_executed' | 'document_created';

export const trackUserAction = async ({
  sessionId,
  eventId,
  actionType,
}: {
  sessionId: string;
  eventId: string;
  actionType: UserActionType;
}): Promise<void> => {
  return fetch<void>({
    method: 'POST',
    path: '/v3/users/me/actions',
    sessionId,
    data: { event_id: eventId, action_type: actionType },
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
