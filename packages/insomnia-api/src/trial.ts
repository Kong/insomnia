import { fetch } from './fetch';

// GET /v1/trials/eligibility
interface TrialEligibility {
  isEligible: boolean;
}

export const getTrialEligibility = ({ sessionId }: { sessionId: string }) => {
  return fetch<TrialEligibility>({
    method: 'GET',
    path: '/v1/trials/eligibility',
    sessionId,
  });
};

// POST /v1/trials/start
interface StartTrialResult {
  success: boolean;
}

export const startTrial = ({ sessionId }: { sessionId: string }) => {
  return fetch<StartTrialResult>({
    method: 'POST',
    path: '/v1/trials/start',
    sessionId,
  });
};
