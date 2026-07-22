import crypto from 'node:crypto';

// F1: `resolveDbByKey` dispatches every `plugin.*`/db handler over the app-wide-privileged
// `insomnia-templating-worker-database://` protocol, which — unlike the `plugins.*` ipcMain
// channels — has no caller identity to check (a `protocol.handle` request carries no sender
// reference). A per-process secret, known only to the trusted first-party renderer/plugin-window
// (handed out over an IPC channel that itself checks the sender), closes that gap: anything that
// can `fetch()` the scheme still reaches the handler, but can't produce a valid token.
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
