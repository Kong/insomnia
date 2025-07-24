import type { IconName, IconProp } from '@fortawesome/fontawesome-svg-core';
import React, { type FC, useEffect, useState } from 'react';
import {
  Button,
  Collection,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  Separator,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import { useFetcher, useParams, useRevalidator } from 'react-router';
import { useInterval } from 'react-use';

import type { GitRepository } from '../../../models/git-repository';
import { getOauth2FormatName } from '../../../sync/git/utils';
import type { MergeConflict } from '../../../sync/types';
import {
  checkGitCanPush,
  checkGitChanges,
  continueMerge,
  type GitFetchLoaderData,
  type GitRepoLoaderData,
  type GitStatusResult,
  pullFromGitRemote,
  type PushToGitRemoteResult,
} from '../../routes/$organizationId.project.$projectId.git';
import { ConfigLink } from '../github-app-config-link';
import { Icon } from '../icon';
import { showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';
import { GitProjectBranchesModal } from '../modals/git-project-branches-modal';
import { GitProjectLogModal } from '../modals/git-project-log-modal';
import { GitProjectMigrationModal } from '../modals/git-project-migration-modal';
import { GitProjectStagingModal } from '../modals/git-project-staging-modal';
import { GitProjectRepositorySettingsModal } from '../modals/git-repository-settings-modal';
import { SyncMergeModal } from '../modals/sync-merge-modal';

interface Props {
  gitRepository: GitRepository | null;
}

export const GitProjectSyncDropdown: FC<Props> = ({ gitRepository }) => {
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
  };

  const [isGitRepoSettingsModalOpen, setIsGitRepoSettingsModalOpen] = useState(false);
  const [isGitBranchesModalOpen, setIsGitBranchesModalOpen] = useState(false);
  const [isGitLogModalOpen, setIsGitLogModalOpen] = useState(false);
  const [isGitStagingModalOpen, setIsGitStagingModalOpen] = useState(false);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);

  const gitPushFetcher = useFetcher<PushToGitRemoteResult>();
  const gitCheckoutFetcher = useFetcher();
  const gitRepoDataFetcher = useFetcher<GitRepoLoaderData>();
  const gitFetchFetcher = useFetcher<GitFetchLoaderData>();
  const gitStatusFetcher = useFetcher<GitStatusResult>();

  const loadingPush = gitPushFetcher.state === 'loading';
  const loadingFetch = gitFetchFetcher.state === 'loading';

  const [isPulling, setIsPulling] = useState(false);

  useEffect(() => {
    if (gitRepository?.uri && gitRepository?._id && gitRepoDataFetcher.state === 'idle' && !gitRepoDataFetcher.data) {
      // file://./../../routes/git-actions.tsx#gitRepoLoader
      gitRepoDataFetcher.load(`/organization/${organizationId}/project/${projectId}/git/repo`);
    }
  }, [gitRepoDataFetcher, gitRepository?.uri, gitRepository?._id, organizationId, projectId]);

  const legacyInsomniaWorkspace =
    gitRepoDataFetcher.data &&
    'legacyInsomniaWorkspace' in gitRepoDataFetcher.data &&
    gitRepoDataFetcher.data.legacyInsomniaWorkspace
      ? gitRepoDataFetcher.data.legacyInsomniaWorkspace
      : null;

  // Only fetch the repo status if we have a repo uri and we don't have the status already
  const shouldFetchGitRepoStatus = Boolean(
    gitRepository?.uri &&
      gitRepository?._id &&
      gitStatusFetcher.state === 'idle' &&
      !gitStatusFetcher.data &&
      gitRepoDataFetcher.data,
  );

  useEffect(() => {
    if (
      gitRepoDataFetcher.data &&
      !('errors' in gitRepoDataFetcher.data) &&
      gitRepoDataFetcher.data.legacyInsomniaWorkspace
    ) {
      setIsMigrationModalOpen(true);
    }
  }, [gitRepoDataFetcher.data]);

  useEffect(() => {
    if (shouldFetchGitRepoStatus) {
      // file://./../../routes/git-actions.tsx#gitStatusAction
      gitStatusFetcher.submit(
        {},
        {
          action: `/organization/${organizationId}/project/${projectId}/git/status`,
          method: 'post',
        },
      );
    }
  }, [gitStatusFetcher, organizationId, projectId, shouldFetchGitRepoStatus]);

  useEffect(() => {
    // update committed state on unmount
    // this is a sync action which is responsible for cheaply updating a piece of state representing the existence of a diff
    // ideally this would not be needed and a diff would be cheaper to find.
    return () => {
      checkGitChanges(projectId);
    };
  }, [projectId]);

  useEffect(() => {
    if (shouldFetchGitRepoStatus) {
      checkGitCanPush(projectId);
    }
  }, [gitRepoDataFetcher.data, gitRepository?._id, gitRepository?.uri, projectId, shouldFetchGitRepoStatus]);

  useEffect(() => {
    const errors = [...(gitPushFetcher.data?.errors ?? [])];
    if (errors.length > 0) {
      showModal(AlertModal, {
        title: 'Push Failed',
        message: errors.join('\n'),
      });
    }
  }, [gitPushFetcher.data?.errors]);

  useEffect(() => {
    const gitRepoDataErrors =
      gitRepoDataFetcher.data && 'errors' in gitRepoDataFetcher.data ? gitRepoDataFetcher.data.errors : [];
    const errors = [...gitRepoDataErrors];
    if (errors.length > 0) {
      showModal(AlertModal, {
        title: 'Loading of Git Repository Failed',
        message: errors.join('\n'),
      });
    }
  }, [gitRepoDataFetcher.data]);

  useEffect(() => {
    const errors = [...(gitCheckoutFetcher.data?.errors ?? [])];
    if (errors.length > 0) {
      showModal(AlertModal, {
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
        action: `/organization/${organizationId}/project/${projectId}/git/push`,
        method: 'post',
      },
    );
  }

  let icon: IconProp = ['fab', 'git-alt'];
  const providerName = getOauth2FormatName(gitRepository?.credentials);
  if (providerName === 'github') {
    icon = ['fab', 'github'];
  }
  if (providerName === 'gitlab') {
    icon = ['fab', 'gitlab'];
  }

  const isLoading =
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
  }[] = isSynced
    ? [
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
              await pullFromGitRemote({ projectId })
                .then(result => {
                  if ('errors' in result && result.errors) {
                    showModal(AlertModal, {
                      title: 'Pull Failed',
                      message: (
                        <>
                          {result.errors.join('\n')}
                          <ConfigLink {...{ gitRepository, errors: [result.errors.join('\n')] }} />
                        </>
                      ),
                      bodyClassName: 'whitespace-break-spaces',
                    });
                  }
                  if ('conflicts' in result) {
                    showModal(SyncMergeModal, {
                      conflicts: result.conflicts,
                      labels: result.labels,
                      handleDone: (conflicts?: MergeConflict[]) => {
                        if (Array.isArray(conflicts) && conflicts.length > 0) {
                          setIsPulling(true);
                          continueMerge({
                            projectId,
                            handledMergeConflicts: conflicts,
                            commitMessage: result.commitMessage,
                            commitParent: result.commitParent,
                          }).finally(() => {
                            setIsPulling(false);
                            revalidate();
                          });
                        } else {
                          // user aborted merge, do nothing
                        }
                      },
                    });
                  }
                })
                .finally(() => {
                  setIsPulling(false);
                  revalidate();
                });
            } catch (err) {
              const message = err instanceof Error ? err.message : 'An error occurred while pulling';
              showModal(AlertModal, {
                title: 'Pull Failed',
                message: (
                  <>
                    {message}
                    <ConfigLink {...{ gitRepository, errors: [message] }} />
                  </>
                ),
                bodyClassName: 'whitespace-break-spaces',
              });
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
                action: `/organization/${organizationId}/project/${projectId}/git/fetch`,
                method: 'post',
              },
            );
          },
        },
      ]
    : [];

  const gitSyncActions: {
    id: string;
    label: string;
    icon: IconName;
    isDisabled?: boolean;
    action: () => void;
  }[] = isSynced
    ? [
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
      ]
    : [
        {
          id: 'connect',
          label: 'Connect Repository',
          icon: 'plug',
          isDisabled: false,
          action: () => setIsGitRepoSettingsModalOpen(true),
        },
      ];

  useInterval(
    () => {
      gitFetchFetcher.submit(
        {},
        {
          action: `/organization/${organizationId}/project/${projectId}/git/fetch`,
          method: 'post',
        },
      );
    },
    1000 * 60 * 5,
  );

  const status = gitStatusFetcher.data?.status;

  const branchesActionList: {
    id: string;
    label: string;
    icon: IconName;
    isDisabled?: boolean;
    isActive: boolean;
    action: () => void;
  }[] = isSynced
    ? branches.map(branch => ({
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
              action: `/organization/${organizationId}/project/${projectId}/git/branch/checkout`,
              method: 'post',
            },
          );
        },
      }))
    : [];

  const allSyncMenuActionList = [...gitSyncActions, ...branchesActionList, ...currentBranchActions];

  const pendingChangesCount = status?.localChanges ?? 0;

  return (
    <>
      <MenuTrigger>
        <TooltipTrigger
          delay={0}
          onOpenChange={isOpen => {
            const shouldFetchGitRepoStatus = isOpen && gitStatusFetcher.state === 'idle';
            shouldFetchGitRepoStatus &&
              gitStatusFetcher.submit(
                {},
                {
                  action: `/organization/${organizationId}/project/${projectId}/git/status`,
                  method: 'post',
                },
              );
          }}
        >
          <Button
            isDisabled={isLoading}
            data-testid="git-dropdown"
            aria-label="Git Sync"
            className={`flex h-[--line-height-sm] w-full items-center gap-2 px-[--padding-md] text-sm text-[--color-font] ring-1 ring-transparent transition-all ${isLoading ? 'animate-pulse' : 'hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]'}`}
          >
            <Icon icon={icon} className="size-4" />
            <Separator orientation="vertical" className="h-5 border border-solid border-[--hl-sm] bg-[--color-bg]" />
            <div className="relative flex items-center">
              <Icon icon={isLoading ? 'spinner' : 'code-branch'} className={`size-4 ${isLoading && 'animate-spin'}`} />
              {pendingChangesCount > 0 && (
                <div className="absolute -bottom-2 -right-1 h-[12px] min-w-[12px] bg-[--color-surprise] px-[4px] text-center font-semibold text-[--color-font-surprise] [border-radius:20px] [font-size:6px] [line-height:12px]">
                  {pendingChangesCount}
                </div>
              )}
            </div>
            <span className="flex-1 truncate">
              {isSynced ? currentBranch : gitRepoDataFetcher.state !== 'idle' ? 'Syncing...' : 'Not synced'}
            </span>
          </Button>
          <Tooltip
            offset={8}
            className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
          >
            <div>
              Connected to <span className="capitalize">{providerName}</span>
            </div>
            <span>{pendingChangesCount} pending changes</span>
          </Tooltip>
        </TooltipTrigger>
        <Popover className="min-w-max max-w-lg overflow-hidden" placement="top end" offset={8}>
          <Menu
            aria-label="Git Sync Menu"
            selectionMode="single"
            disabledKeys={allSyncMenuActionList.filter(item => item?.isDisabled).map(item => item.id)}
            onAction={key => {
              const item = allSyncMenuActionList.find(item => item.id === key);
              item?.action();
            }}
            className="max-h-[85vh] max-w-lg select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] py-2 text-sm shadow-lg focus:outline-none"
          >
            <MenuSection className="border-b border-solid border-[--hl-sm] pb-2 empty:border-none empty:pb-0">
              <Collection items={gitSyncActions}>
                {item => (
                  <MenuItem
                    className={
                      'text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-selected:font-bold'
                    }
                    aria-label={item.label}
                  >
                    <Icon icon={item.icon} />
                    <span>{item.label}</span>
                  </MenuItem>
                )}
              </Collection>
            </MenuSection>
            <MenuSection className="border-b border-solid border-[--hl-sm] pb-2 empty:border-none empty:pb-0">
              <Collection items={branchesActionList}>
                {item => (
                  <MenuItem
                    className={`text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-selected:font-bold ${item.isActive ? 'font-bold' : ''}`}
                    aria-label={item.label}
                  >
                    <Icon icon={item.icon} className={item.isActive ? 'text-[--color-success]' : ''} />
                    <span className="truncate">{item.label}</span>
                  </MenuItem>
                )}
              </Collection>
            </MenuSection>
            <MenuSection>
              <Collection items={currentBranchActions}>
                {item => (
                  <MenuItem
                    className={
                      'text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-selected:font-bold'
                    }
                    aria-label={item.label}
                  >
                    <Icon icon={item.icon} />
                    <span>{item.label}</span>
                  </MenuItem>
                )}
              </Collection>
            </MenuSection>
          </Menu>
        </Popover>
      </MenuTrigger>
      {isGitRepoSettingsModalOpen && (
        <GitProjectRepositorySettingsModal
          gitRepository={gitRepository ?? undefined}
          onHide={() => setIsGitRepoSettingsModalOpen(false)}
        />
      )}
      {isGitBranchesModalOpen && gitRepository && (
        <GitProjectBranchesModal
          onClose={() => setIsGitBranchesModalOpen(false)}
          currentBranch={currentBranch}
          branches={branches}
        />
      )}
      {isGitLogModalOpen && gitRepository && <GitProjectLogModal onClose={() => setIsGitLogModalOpen(false)} />}
      {isGitStagingModalOpen && gitRepository && (
        <GitProjectStagingModal onClose={() => setIsGitStagingModalOpen(false)} />
      )}
      {isMigrationModalOpen && gitRepository && legacyInsomniaWorkspace && (
        <GitProjectMigrationModal
          legacyFile={legacyInsomniaWorkspace}
          onClose={() => {
            setIsMigrationModalOpen(false);
          }}
        />
      )}
    </>
  );
};
