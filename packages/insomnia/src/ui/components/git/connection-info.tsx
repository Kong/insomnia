import { useEffect, useState } from 'react';

import type { GitRepository } from '~/models/git-repository';
import { getDefaultOAuthProvider } from '~/ui/components/modals/git-repository-settings-modal/git-repository-settings-modal';

import { GitProviderTag } from './git-provider-tag';

export const GitConnectionInfo = ({
  gitRepository,
  projectId,
}: {
  gitRepository?: GitRepository;
  projectId?: string;
}) => {
  const [branch, setBranch] = useState('');
  useEffect(() => {
    if (!gitRepository || !projectId) {
      return;
    }
    (async () => {
      const branch = await window.main.git.getCurrentBranchByRepositoryId({
        repositoryId: gitRepository._id,
        projectId,
      });
      setBranch(branch);
    })();
  }, [gitRepository, projectId]);

  if (!gitRepository) {
    return null;
  }

  const provider = getDefaultOAuthProvider(gitRepository.credentials);
  const repoUrl = gitRepository.uri;
  return (
    <div className="text-[12px]">
      <div className="mb-6 font-semibold text-(--hl)">Connection Info</div>
      <div className="flex flex-col gap-4">
        <dl className="flex">
          <dt className="w-[110px] font-semibold">Provider</dt>
          <dd>
            <GitProviderTag provider={provider} />
          </dd>
        </dl>
        <dl className="flex">
          <dt className="w-[110px] font-semibold">Repo URL</dt>
          <dd>
            <a href={repoUrl}>{repoUrl}</a>
          </dd>
        </dl>
        {branch && (
          <div className="flex">
            <div className="w-[110px] font-semibold">Base Branch</div>
            <div>{branch}</div>
          </div>
        )}
      </div>
    </div>
  );
};
