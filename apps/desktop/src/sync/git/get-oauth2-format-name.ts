import type { GitRepoCredentials, OauthProviderName } from 'insomnia-data';

export const getOauth2FormatName = (credentials?: GitRepoCredentials | null): OauthProviderName | undefined => {
  if (credentials && 'oauth2format' in credentials) {
    return credentials.oauth2format;
  }

  return;
};
