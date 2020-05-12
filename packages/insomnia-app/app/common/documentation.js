// @flow
export const DocumentationArticle = Object.freeze({
  base: '/',
  gitSync: '/article/96-git-sync',
});

export type DocumentationArticleType = $Values<typeof DocumentationArticle>;

export function getDocumentationUrl(article: DocumentationArticleType): string {
  return `https://support.insomnia.rest${article || ''}`;
}
