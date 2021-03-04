// @flow
function insomniaDocs(slug: string): string {
  return `https://support.insomnia.rest${slug}`;
}

export const docsBase = insomniaDocs('/');
export const docsGitSync = insomniaDocs('/article/193-git-sync');
export const docsTemplateTags = insomniaDocs('/article/171-template-tags');
export const docsVersionControl = insomniaDocs('/article/165-version-control-sync');
export const docsPlugins = insomniaDocs('/article/173-plugins');
export const docsImportExport = insomniaDocs('/article/172-importing-and-exporting-data');

export const docsGitAccessToken = {
  github:
    'https://docs.github.com/github/authenticating-to-github/creating-a-personal-access-token',
  gitlab: 'https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html',
  bitbucket: 'https://support.atlassian.com/bitbucket-cloud/docs/app-passwords/',
  bitbucketServer:
    'https://confluence.atlassian.com/bitbucketserver/personal-access-tokens-939515499.html',
};
