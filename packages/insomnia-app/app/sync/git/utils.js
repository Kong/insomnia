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
