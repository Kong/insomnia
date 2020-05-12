// @flow
export const DocumentationArticle = {
  base: 'base',
  gitSync: 'gitSync',
};

export type DocumentationArticleType = $Keys<typeof DocumentationArticle>;

const DocumentationLookup: { [DocumentationArticleType]: string } = {
  [DocumentationArticle.base]: '/',
  [DocumentationArticle.gitSync]: '/article/96-git-sync',
};

export function getDocumentationUrl(article: DocumentationArticleType): string {
  return `https://support.insomnia.rest${DocumentationLookup[article] || ''}`;
}
