// @flow
export const translateSSHtoHTTP = (url: string) => {
  // handle "shorter scp-like syntax"
  url = url.replace(/^git@([^:]+):/, 'https://$1/');
  // handle proper SSH URLs
  url = url.replace(/^ssh:\/\//, 'https://');
  return url;
};

export const addDotGit = ({ url }: { url: string }) => {
  if (url.endsWith('.git')) {
    return url;
  }

  return `${url}.git`;
};

const onMessage = (message: string) => {
  console.log(`[git-event] ${message}`);
};

const onAuthFailure = (message: string) => {
  console.log(`[git-event] Auth Failure: ${message}`);
};

const onAuthSuccess = (message: string) => {
  console.log(`[git-event] Auth Success: ${message}`);
};

const onAuth = (
  credentials?: { username: string, password?: string, token?: string } = {},
) => () => ({
  username: credentials.username,
  password: credentials.password || credentials.token,
});

export const gitCallbacks = (credentials?: {
  username: string,
  password?: string,
  token?: string,
}) => ({
  onMessage,
  onAuthFailure,
  onAuthSuccess,
  onAuth: onAuth(credentials),
});
