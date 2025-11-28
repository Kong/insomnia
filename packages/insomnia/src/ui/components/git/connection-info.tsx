import type { GitRepository } from '~/models/git-repository';
import { getDefaultOAuthProvider } from '~/ui/components/modals/git-repository-settings-modal/git-project-repository-settings-modal';

import { GitProviderTag } from './git-provider-tag';

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
          <GitProviderTag provider={provider} />
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
