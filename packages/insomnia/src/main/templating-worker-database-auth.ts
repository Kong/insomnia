import crypto from 'node:crypto';

// Per-process secret required on every request to the templating db protocol, since that
// protocol has no sender identity to check on its own.
let token: string | null = null;

export const getOrCreateTemplatingDbAuthToken = (): string => {
  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
  }
  return token;
};

export const TEMPLATING_DB_AUTH_HEADER = 'x-insomnia-templating-auth';

export const isValidTemplatingDbAuthToken = (candidate: string | null | undefined): boolean => {
  if (!token || !candidate || candidate.length !== token.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(token));
};

export const _testOnlyResetTemplatingDbAuthToken = () => {
  token = null;
};
