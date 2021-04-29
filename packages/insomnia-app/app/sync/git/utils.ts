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

const onAuth = (credentials: GitCredentials = {}) => () => ({
  username: credentials.username,
  password: credentials.password || credentials.token,
});

export const gitCallbacks = (credentials?: GitCredentials) => ({
  onMessage,
  onAuthFailure,
  onAuthSuccess,
  onAuth: onAuth(credentials),
});
