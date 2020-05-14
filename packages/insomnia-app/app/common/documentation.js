// @flow
function insomniaDocs(slug: string): string {
  return `https://support.insomnia.rest${slug}`;
}

export default {
  getBase: () => insomniaDocs('/'),
  getGitSync: () => insomniaDocs('/article/96-git-sync'),
};
