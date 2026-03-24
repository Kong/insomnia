import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { useEffect, useState } from 'react';
import { Button, Separator } from 'react-aria-components';

import { Icon } from '~/basic-components/icon';
import type { GitRepository } from '~/models/git-repository';
import { showSettingsModal } from '~/ui/components/modals/settings-modal';

export const GitConnectionInfo = ({
  gitRepository,
  providerInfo,
  authorName,
  projectId,
}: {
  projectId?: string;
  gitRepository?: GitRepository;
  authorName?: string;
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
    <div>
      <div className="p-2">
        <div className="mb-3 font-semibold text-(--hl)">Connection Info</div>
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
      {authorName && (
        <div className="mt-3 p-2">
          <div className="mb-3 font-semibold text-(--hl)">Authorized as</div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-1">
              {providerInfo?.iconName && <Icon icon={providerInfo.iconName} className="size-4" />}
              <span>{providerInfo?.displayName}</span>
              <Separator orientation="vertical" className="mx-2 h-4 border-l border-(--color-font)" />
              <span className="truncate">{authorName}</span>
              <Button className="text-(--color-surprise)" onPress={() => showSettingsModal({ tab: 'credentials' })}>
                View Credential
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
