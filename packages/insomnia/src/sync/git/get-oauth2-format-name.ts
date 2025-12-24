import type { GitCredentials, OauthProviderName } from '~/models/git-repository';

export const getOauth2FormatName = (credentials?: GitCredentials | null): OauthProviderName | undefined => {
  if (credentials && 'oauth2format' in credentials) {
    return credentials.oauth2format;
  }

  return;
};
