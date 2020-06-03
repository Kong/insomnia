// @flow
function insomniaDocs(slug: string): string {
  return `https://support.insomnia.rest${slug}`;
}

export const docsBase = insomniaDocs('/');
export const docsGitSync = insomniaDocs('/article/96-git-sync');
