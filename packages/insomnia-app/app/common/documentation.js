// @flow
function insomniaDocs(slug: string): string {
  return `https://support.insomnia.rest${slug}`;
}

export const docsBase = insomniaDocs('/');
export const docsGitSync = insomniaDocs('/article/96-git-sync');
export const docsGitAccessToken = {
  github:
    'https://docs.github.com/github/authenticating-to-github/creating-a-personal-access-token',
  gitlab: 'https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html',
  bitbucket: 'https://support.atlassian.com/bitbucket-cloud/docs/app-passwords/',
  bitbucketServer:
    'https://confluence.atlassian.com/bitbucketserver/personal-access-tokens-939515499.html',
};
