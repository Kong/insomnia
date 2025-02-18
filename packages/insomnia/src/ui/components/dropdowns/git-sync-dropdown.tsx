import type { IconName, IconProp } from '@fortawesome/fontawesome-svg-core';
import React, { type FC, useEffect, useState } from 'react';
import { Button, Collection, Menu, MenuItem, MenuTrigger, Popover, Section, Tooltip, TooltipTrigger } from 'react-aria-components';
import { useFetcher, useParams, useRevalidator } from 'react-router-dom';
import { useInterval } from 'react-use';

import type { GitRepository } from '../../../models/git-repository';
import { MergeConflictError } from '../../../sync/git/git-vcs';
import { getOauth2FormatName } from '../../../sync/git/utils';
import type { MergeConflict } from '../../../sync/types';
import {
  continueMerge,
  type GitFetchLoaderData,
  type GitRepoLoaderData,
  type GitStatusResult,
  pullFromGitRemote,
  type PushToGitRemoteResult,
} from '../../routes/git-actions';
import { ConfigLink } from '../github-app-config-link';
import { Icon } from '../icon';
import { showAlert, showModal } from '../modals';
import { GitBranchesModal } from '../modals/git-branches-modal';
import { GitLogModal } from '../modals/git-log-modal';
import { GitRepositorySettingsModal } from '../modals/git-repository-settings-modal';
import { GitStagingModal } from '../modals/git-staging-modal';
import { SyncMergeModal } from '../modals/sync-merge-modal';

interface Props {
  gitRepository: GitRepository | null;
  isInsomniaSyncEnabled: boolean;
}

export const GitSyncDropdown: FC<Props> = ({ gitRepository, isInsomniaSyncEnabled }) => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const [isGitRepoSettingsModalOpen, setIsGitRepoSettingsModalOpen] =
    useState(false);
  const [isGitBranchesModalOpen, setIsGitBranchesModalOpen] = useState(false);
  const [isGitLogModalOpen, setIsGitLogModalOpen] = useState(false);
  const [isGitStagingModalOpen, setIsGitStagingModalOpen] = useState(false);

  const gitPushFetcher = useFetcher<PushToGitRemoteResult>();
  const gitCheckoutFetcher = useFetcher();
  const gitRepoDataFetcher = useFetcher<GitRepoLoaderData>();
  const gitFetchFetcher = useFetcher<GitFetchLoaderData>();
  const gitStatusFetcher = useFetcher<GitStatusResult>();
  const resetGitStatusFetcher = useFetcher();

  const loadingPush = gitPushFetcher.state === 'loading';
  const loadingFetch = gitFetchFetcher.state === 'loading';
  const loadingStatus = gitStatusFetcher.state === 'loading';

  const [isPulling, setIsPulling] = useState(false);

  useEffect(() => {
    if (
      gitRepository?.uri &&
      gitRepository?._id &&
      gitRepoDataFetcher.state === 'idle' &&
      !gitRepoDataFetcher.data
    ) {
      // file://./../../routes/git-actions.tsx#gitRepoLoader
      gitRepoDataFetcher.load(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/repo`);
    }
  }, [
    gitRepoDataFetcher,
    gitRepository?.uri,
    gitRepository?._id,
    organizationId,
    projectId,
    workspaceId,
  ]);

  // Only fetch the repo status if we have a repo uri and we don't have the status already
  const shouldFetchGitRepoStatus = Boolean(gitRepository?.uri && gitRepository?._id && gitStatusFetcher.state === 'idle' && !gitStatusFetcher.data && gitRepoDataFetcher.data);

  useEffect(() => {
    if (shouldFetchGitRepoStatus) {
      // file://./../../routes/git-actions.tsx#gitStatusAction
      gitStatusFetcher.submit({}, {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/status`,
        method: 'post',
      });
    }
  }, [gitStatusFetcher, organizationId, projectId, shouldFetchGitRepoStatus, workspaceId]);

  useEffect(() => {
    const errors = [...(gitPushFetcher.data?.errors ?? [])];
    if (errors.length > 0) {
      showAlert({
        title: 'Push Failed',
        message: <>
          {errors.join('\n')}
          <ConfigLink {...gitPushFetcher.data} />
        </>,
      });
    }
  }, [gitPushFetcher.data]);

  useEffect(() => {
    const gitRepoDataErrors =
      gitRepoDataFetcher.data && 'errors' in gitRepoDataFetcher.data
        ? gitRepoDataFetcher.data.errors
        : [];
    const errors = [...gitRepoDataErrors];
    if (errors.length > 0) {
      if (isGitRepoSettingsModalOpen) { // user just clicked 'Reset'
        return;
      }
      showAlert({
        title: 'Loading of Git Repository Failed',
        message: errors.join('\n'),
      });
    }
  }, [isGitRepoSettingsModalOpen, gitRepoDataFetcher.data]);

  useEffect(() => {
    const errors = [...(gitCheckoutFetcher.data?.errors ?? [])];
    if (errors.length > 0) {
      showAlert({
        title: 'Checkout Failed',
        message: errors.join('\n'),
      });
    }
  }, [gitCheckoutFetcher.data?.errors]);

  async function handlePush({ force }: { force: boolean }) {
    gitPushFetcher.submit(
      {
        force: `${force}`,
      },
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/push`,
        method: 'post',
      }
    );
  }

  let iconClassName: IconProp = ['fab', 'git-alt'];
  const providerName = getOauth2FormatName(gitRepository?.credentials);
  if (providerName === 'github') {
    iconClassName = ['fab', 'github'];
  }
  if (providerName === 'gitlab') {
    iconClassName = ['fab', 'gitlab'];
  }

  const isLoading =
    gitRepoDataFetcher.state === 'loading' ||
    gitFetchFetcher.state === 'loading' ||
    gitCheckoutFetcher.state === 'loading' ||
    gitPushFetcher.state === 'loading' ||
    isPulling;

  const isSynced = Boolean(gitRepository?.uri && gitRepoDataFetcher.data && !('errors' in gitRepoDataFetcher.data));

  const { branches, branch: currentBranch } =
    gitRepoDataFetcher.data && 'branches' in gitRepoDataFetcher.data
      ? gitRepoDataFetcher.data
      : { branches: [], branch: '' };

  const { revalidate } = useRevalidator();

  const currentBranchActions: {
    id: string;
    label: string;
    icon: IconName;
    isDisabled?: boolean;
    action: () => void;
  }[] = (isSynced ? [
    {
      id: 'commit',
      icon: 'check',
      isDisabled: false,
      label: 'Commit',
      action: () => setIsGitStagingModalOpen(true),
    },
    {
      id: 'pull',
      icon: isPulling ? 'refresh' : 'cloud-download',
      label: 'Pull',
      isDisabled: false,
      action: async () => {
        try {
          setIsPulling(true);
          await pullFromGitRemote({ projectId, workspaceId }).finally(() => {
            setIsPulling(false);
            revalidate();
          });
        } catch (err) {
          if (err instanceof MergeConflictError) {
            const data = err.data;
            showModal(SyncMergeModal, {
              conflicts: data.conflicts,
              labels: data.labels,
              handleDone: (conflicts?: MergeConflict[]) => {
                if (Array.isArray(conflicts) && conflicts.length > 0) {
                  setIsPulling(true);
                  continueMerge({
                    projectId,
                    workspaceId,
                    handledMergeConflicts: conflicts,
                    commitMessage: data.commitMessage,
                    commitParent: data.commitParent,
                  }).finally(() => {
                    setIsPulling(false);
                    revalidate();
                  });
                } else {
                  // user aborted merge, do nothing
                }
              },
            });
          } else {
            showAlert({
              title: 'Pull Failed',
              message: <>
                {err.message}
                <ConfigLink {...{ gitRepository, errors: [err.message] }} />
              </>,

              bodyClassName: 'whitespace-break-spaces',
            });
          }
        }
      },
    },
    {
      id: 'push',
      icon: loadingPush ? 'refresh' : 'cloud-upload',
      label: 'Push',
      isDisabled: false,
      action: () => handlePush({ force: false }),
    },
    {
      id: 'history',
      icon: 'clock',
      isDisabled: false,
      label: 'History',
      action: () => setIsGitLogModalOpen(true),
    },
    {
      id: 'fetch',
      icon: loadingFetch ? 'refresh' : 'refresh',
      isDisabled: false,
      label: 'Fetch',
      action: () => {
        gitFetchFetcher.submit(
          {},
          {
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/fetch`,
            method: 'post',
          }
        );
      },
    },
    ] : []);

  const gitSyncActions: {
    id: string;
    label: string;
    icon: IconName;
    isDisabled?: boolean;
    action: () => void;
  }[] = (isSynced ? [
    {
      id: 'repository-settings',
      label: 'Repository Settings',
      isDisabled: false,
      icon: 'wrench',
      action: () => setIsGitRepoSettingsModalOpen(true),
    },
    {
      id: 'branches',
      label: 'Branches',
      isDisabled: false,
      icon: 'code-branch',
      action: () => setIsGitBranchesModalOpen(true),
    },
  ] : [{
    id: 'connect',
    label: 'Connect Repository',
    icon: 'plug',
    isDisabled: false,
    action: () => setIsGitRepoSettingsModalOpen(true),
  }]);

  useInterval(() => {
    gitFetchFetcher.submit(
      {},
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/fetch`,
        method: 'post',
      }
    );
  }, 1000 * 60 * 5);

  const status = gitStatusFetcher.data?.status;

  const commitToolTipMsg = status?.localChanges ? 'Local changes made' : 'No local changes made';

  const switchToInsomniaSyncList: {
    id: string;
    label: string;
    icon: IconProp;
    isDisabled?: boolean;
    action: () => void;
  }[] = isInsomniaSyncEnabled ? [
    {
      id: 'switch-to-git-repo',
      label: 'Switch to Insomnia Sync',
      icon: 'cloud',
      action: async () => {
        resetGitStatusFetcher.submit({}, {
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/reset`,
          method: 'post',
        });
        },
      },
    ] : [];

  const branchesActionList: {
    id: string;
    label: string;
    icon: IconName;
    isDisabled?: boolean;
    isActive: boolean;
    action: () => void;
  }[] = isSynced ? branches.map(branch => ({
    id: branch,
    label: branch,
    isActive: branch === currentBranch,
    icon: 'code-branch',
    action: async () => {
      // file://./../../routes/git-actions.tsx#gitCheckoutAction
      gitCheckoutFetcher.submit(
        {
          branch,
        },
        {
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/branch/checkout`,
          method: 'post',
        }
      );
    },
  })) : [];

  const allSyncMenuActionList = [...switchToInsomniaSyncList, ...gitSyncActions, ...branchesActionList, ...currentBranchActions];

  return (
    <>
      <MenuTrigger>
        <div className="flex items-center h-[--line-height-sm] w-full aria-pressed:bg-[--hl-sm] text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
          <Button
            data-testid="git-dropdown"
            aria-label="Git Sync"
            className="flex-1 flex h-full items-center gap-2 truncate px-[--padding-md]"
          >
            <Icon
              icon={isLoading ? 'refresh' : iconClassName}
              className={`w-5 ${isLoading ? 'animate-spin' : ''}`}
            />
            <span className='truncate'>{isSynced ? currentBranch : 'Not synced'}</span>
          </Button>
          <TooltipTrigger>
            <Button className="px-[--padding-md] h-full">
              <Icon icon={loadingStatus ? 'refresh' : 'cube'} className={`transition-colors ${isLoading ? 'animate-pulse' : loadingStatus ? 'animate-spin' : 'opacity-50'}`} />
            </Button>
            <Tooltip
              placement="top end"
              offset={8}
              className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
            >
              {commitToolTipMsg}
            </Tooltip>
          </TooltipTrigger>
        </div>
        <Popover className="min-w-max max-w-lg overflow-hidden" placement='top end' offset={8}>
          <Menu
            aria-label="Git Sync Menu"
            selectionMode="single"
            disabledKeys={allSyncMenuActionList.filter(item => item?.isDisabled).map(item => item.id)}
            onAction={key => {
              const item = allSyncMenuActionList.find(item => item.id === key);
              item?.action();
            }}
            className="border max-w-lg select-none text-sm border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
          >
            <Section className='border-b border-solid border-[--hl-sm] pb-2 empty:pb-0 empty:border-none'>
              <Collection items={switchToInsomniaSyncList}>
                {item => (
                  <MenuItem
                    textValue={item.label}
                    className={'group aria-disabled:opacity-30 aria-disabled:cursor-not-allowed flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent disabled:cursor-not-allowed focus:outline-none transition-colors'}
                    aria-label={item.label}
                  >
                    <div className="px-4 text-[--color-font-surprise] w-full bg-opacity-100 bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:opacity-80 rounded-sm hover:bg-opacity-80 group-pressed:opacity-80 group-hover:bg-opacity-80 group-focus:bg-opacity-80 group-focus:ring-inset group-hover:ring-inset focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                      <Icon icon={item.icon} />
                      <div>{item.label}</div>
                    </div>
                  </MenuItem>
                )}
              </Collection>
            </Section>
            <Section className='border-b border-solid border-[--hl-sm] pb-2 empty:pb-0 empty:border-none'>
              <Collection items={gitSyncActions}>
                {item => (
                  <MenuItem
                    className={'aria-disabled:opacity-30 aria-disabled:cursor-not-allowed flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors'}
                    aria-label={item.label}
                  >
                    <Icon icon={item.icon} />
                    <span>{item.label}</span>
                  </MenuItem>
                )}
              </Collection>
            </Section>
            <Section className='border-b border-solid border-[--hl-sm] pb-2 empty:pb-0 empty:border-none'>
              <Collection items={branchesActionList}>
                {item => (
                  <MenuItem
                    className={`aria-disabled:opacity-30 aria-disabled:cursor-not-allowed flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors ${item.isActive ? 'font-bold' : ''}`}
                    aria-label={item.label}
                  >
                    <Icon icon={item.icon} className={item.isActive ? 'text-[--color-success]' : ''} />
                    <span className='truncate'>{item.label}</span>
                  </MenuItem>
                )}
              </Collection>
            </Section>
            <Section>
              <Collection items={currentBranchActions}>
                {item => (
                  <MenuItem
                    className={'aria-disabled:opacity-30 aria-disabled:cursor-not-allowed flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors'}
                    aria-label={item.label}
                  >
                    <Icon icon={item.icon} />
                    <span>{item.label}</span>
                  </MenuItem>
                )}
              </Collection>
            </Section>
          </Menu>
        </Popover>
      </MenuTrigger>
      {isGitRepoSettingsModalOpen && (
        <GitRepositorySettingsModal
          gitRepository={gitRepository ?? undefined}
          onHide={() => setIsGitRepoSettingsModalOpen(false)}
        />
      )}
      {isGitBranchesModalOpen && gitRepository && (
        <GitBranchesModal
          onClose={() => setIsGitBranchesModalOpen(false)}
          currentBranch={currentBranch}
          branches={branches}
        />
      )}
      {isGitLogModalOpen && gitRepository && (
        <GitLogModal
          onClose={() => setIsGitLogModalOpen(false)}
        />
      )}
      {isGitStagingModalOpen && gitRepository && (
        <GitStagingModal
          onClose={() => setIsGitStagingModalOpen(false)}
        />
      )}
    </>
  );
};
