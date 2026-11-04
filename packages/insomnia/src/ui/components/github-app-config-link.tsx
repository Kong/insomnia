import type { GitRepository } from 'insomnia-data';

import { getOauth2FormatName } from '~/sync/git/get-oauth2-format-name';

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
  const show =
    gitRepository?.credentials &&
    'oauth2format' in gitRepository.credentials &&
    getOauth2FormatName(gitRepository?.credentials) === 'github' &&
    isGitHubAppUserToken(gitRepository?.credentials.token) &&
    errors &&
    errors?.length > 0 &&
    errors[0].startsWith('HTTP Error: 40');

  return (
    show && (
      <p className={`text-${small ? 'sm' : 'md'}`}>
        You may need to{' '}
        <a className="text-purple-500 underline" href="https://github.com/settings/applications">
          Configure the App <i className="fa-solid fa-up-right-from-square" />
        </a>
      </p>
    )
  );
};
