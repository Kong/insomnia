import type { GitCredentials } from './git-vcs';

export const translateSSHtoHTTP = (url: string) => {
  // handle "shorter scp-like syntax"
  url = url.replace(/^git@([^:]+):/, 'https://$1/');
  // handle proper SSH URLs
  url = url.replace(/^ssh:\/\//, 'https://');
  return url;
};

export const addDotGit = (url: string): string => (url.endsWith('.git') ? url : `${url}.git`);

const onMessage = (message: string) => {
  console.log(`[git-event] ${message}`);
};

const onAuthFailure = (message: string) => {
  console.log(`[git-event] Auth Failure: ${message}`);
};

const onAuthSuccess = (message: string) => {
  console.log(`[git-event] Auth Success: ${message}`);
};

// @ts-expect-error -- TSCONVERSION this needs to be handled better if credentials is undefined or which union type
const onAuth = (credentials?: GitCredentials = {}) => () => ({
  username: credentials.username,
  // @ts-expect-error -- TSCONVERSION this needs to be handled better if credentials is undefined or which union type
  password: credentials.password || credentials.token,
});

export const gitCallbacks = (credentials?: GitCredentials | null) => ({
  onMessage,
  onAuthFailure,
  onAuthSuccess,
  onAuth: onAuth(credentials || undefined),
});

// unfortunately, as of @types/node:v14.14.32 this type is not exported so we have to hackily grab it from here.
export type BufferEncoding = NonNullable<Parameters<typeof Buffer.from>[1]>;
