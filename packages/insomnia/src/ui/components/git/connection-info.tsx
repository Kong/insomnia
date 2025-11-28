import type { IconProp } from '@fortawesome/fontawesome-svg-core';

import { Icon } from '~/basic-components/icon';
import type { GitRepository, OauthProviderName } from '~/models/git-repository';
import { getDefaultOAuthProvider } from '~/ui/components/modals/git-repository-settings-modal/git-project-repository-settings-modal';

const GitProvider = ({ provider }: { provider: OauthProviderName }) => {
  const icon: Record<OauthProviderName, IconProp> = {
    github: ['fab', 'github'],
    gitlab: ['fab', 'gitlab'],
    custom: 'code-branch',
  };
  return (
    <div>
      <Icon className="mr-1" icon={icon[provider]} />
      {provider}
    </div>
  );
};

export const GitConnectionInfo = ({ gitRepository, branch }: { gitRepository?: GitRepository; branch: string }) => {
  if (!gitRepository) {
    return null;
  }
  const provider = getDefaultOAuthProvider(gitRepository.credentials);
  const repoUrl = gitRepository.uri;
  return (
    <div className="text-[12px]">
      <div className="mb-6 font-semibold text-(--hl)">Connection Info</div>
      <div className="flex flex-col gap-2">
        <div className="flex">
          <div className="w-[110px] font-semibold">Provider</div>
          <GitProvider provider={provider} />
        </div>
        <div className="flex">
          <div className="w-[110px] font-semibold">Repo URL</div>
          <div>{repoUrl}</div>
        </div>
        <div className="flex">
          <div className="w-[110px] font-semibold">Base Branch</div>
          <div>{branch}</div>
        </div>
      </div>
    </div>
  );
};
