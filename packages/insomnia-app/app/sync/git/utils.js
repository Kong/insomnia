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

export const onMessage = (message: string) => {
  console.log(`[git-event] ${message}`);
};

export const onAuthFailure = (message: string) => {
  console.log(`[git-event] Auth Failure: ${message}`);
};

export const onAuthSuccess = (message: string) => {
  console.log(`[git-event] Auth Success: ${message}`);
};
