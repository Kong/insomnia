import type { GitCredentials, GitRepository, OauthProviderName } from '~/models/git-repository';

import { GitProviderTag } from './git-provider-tag';

export function getDefaultOAuthProvider(credentials?: GitCredentials | null): OauthProviderName {
  if (!credentials) {
    return 'github';
  }

  if ('oauth2format' in credentials && credentials.oauth2format) {
    return credentials.oauth2format;
  }

  return 'custom';
}

export const GitConnectionInfo = ({ gitRepository }: { gitRepository?: GitRepository }) => {
  if (!gitRepository) {
    return null;
  }
  const provider = getDefaultOAuthProvider(gitRepository.credentials);
  const repoUrl = gitRepository.uri;
  return (
    <div className="text-[12px]">
      <div className="mb-6 font-semibold text-(--hl)">Connection Info</div>
      <div className="flex flex-col gap-4">
        <div className="flex">
          <div className="w-[110px] font-semibold">Provider</div>
          <GitProviderTag provider={provider} />
        </div>
        <div className="flex">
          <div className="w-[110px] font-semibold">Repo URL</div>
          <div>{repoUrl}</div>
        </div>
        {/* TODO: get repo branch */}
        {/* <div className="flex">
          <div className="w-[110px] font-semibold">Base Branch</div>
          <div>{branch}</div>
        </div> */}
      </div>
    </div>
  );
};
