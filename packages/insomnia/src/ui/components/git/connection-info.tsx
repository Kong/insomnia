import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { useEffect, useState } from 'react';

import { Icon } from '~/basic-components/icon';
import type { GitRepository } from '~/models/git-repository';

export const GitConnectionInfo = ({
  gitRepository,
  providerInfo,
  projectId,
}: {
  projectId?: string;
  gitRepository?: GitRepository;
  providerInfo: {
    iconName?: IconProp;
    displayName: string;
  };
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

  const repoUrl = gitRepository?.uri;

  return (
    <div className="rounded-xs border border-solid border-(--hl-sm) p-2">
      <div className="mb-6 font-semibold text-(--hl)">Connection Info</div>
      <div className="flex flex-col gap-4">
        <dl className="flex">
          <dt className="w-[110px] font-semibold">Provider</dt>
          <dd>
            <div>
              {providerInfo.iconName && <Icon className="mr-1" icon={providerInfo.iconName} />}
              {providerInfo.displayName}
            </div>
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
