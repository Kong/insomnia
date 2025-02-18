import React from 'react';

import { getAppWebsiteBaseURL } from '../../common/constants';
import type { GitRepository } from '../../models/git-repository';
import { getOauth2FormatName } from '../../sync/git/utils';

interface ConfigLinkProps {
  small?: boolean;
  gitRepository?: GitRepository | null;
  errors?: string[];
}

export function isGitHubAppUserToken(token?: string) {
  // old oauth tokens start with 'gho_' and app user tokens start with 'ghu_'
  return `${token}`.startsWith('ghu_');
}

export const ConfigLink = ({ small = false, gitRepository = null, errors = [] }: ConfigLinkProps) => {
  const show = gitRepository?.credentials && 'oauth2format' in gitRepository?.credentials && getOauth2FormatName(gitRepository?.credentials) === 'github' && isGitHubAppUserToken(gitRepository?.credentials.token) && errors && errors?.length > 0 && errors[0].startsWith('HTTP Error: 40');

  return show && <p className={`text-${small ? 'sm' : 'md'}`}>You may need to <a className="underline text-purple-500" href={`${getAppWebsiteBaseURL()}/oauth/github-app`}>Configure the App <i className="fa-solid fa-up-right-from-square" /></a></p>;
};
