import type { IconName, IconProp } from '@fortawesome/fontawesome-svg-core';
import React, { type FC, useEffect, useMemo, useState } from 'react';
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
import { Icon } from '../icon';
import { showModal } from '../modals';
import { GitProjectBranchesModal } from '../modals/git-project-branches-modal';
import { GitProjectLogModal } from '../modals/git-project-log-modal';
import { GitProjectMigrationModal } from '../modals/git-project-migration-modal';
import { GitProjectStagingModal } from '../modals/git-project-staging-modal';
import { GitProjectRepositorySettingsModal } from '../modals/git-repository-settings-modal';
import { SyncMergeModal } from '../modals/sync-merge-modal';
import { showToast } from '../toast-notification';
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
  const gitIntervalFetchFetcher = useFetcher<GitFetchLoaderData>();
  const gitStatusFetcher = useFetcher<GitStatusResult>();

  const [isPulling, setIsPulling] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  const providerName = getOauth2FormatName(gitRepository?.credentials);

  const icon: IconProp = useMemo(() => {
    if (providerName === 'github') {
      return ['fab', 'github'];
    } else if (providerName === 'gitlab') {
      return ['fab', 'gitlab'];
    }
    return ['fab', 'git-alt'];
  }, [providerName]);

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
      showToast({
        icon,
        title: `Push failed`,
        status: 'error',
      });
      setOperationError(errors.join('\n'));
    } else if (gitPushFetcher.data && 'success' in gitPushFetcher.data && gitPushFetcher.data.success) {
      showToast({
        icon,
        title: `Push completed`,
        status: 'success',
      });
    }
  }, [gitPushFetcher.data, icon]);

  useEffect(() => {
    const gitRepoDataErrors =
      gitRepoDataFetcher.data && 'errors' in gitRepoDataFetcher.data ? gitRepoDataFetcher.data.errors : [];
    const errors = [...gitRepoDataErrors];
    if (errors.length > 0) {
      setOperationError(errors.join('\n'));
    }
  }, [gitRepoDataFetcher.data]);

  useEffect(() => {
    const errors = [...(gitCheckoutFetcher.data?.errors ?? [])];
    if (errors.length > 0) {
      setOperationError(errors.join('\n'));
      showToast({
        icon,
        title: `Checkout failed`,
        status: 'error',
      });
    } else if (gitCheckoutFetcher.data && 'success' in gitCheckoutFetcher.data && gitCheckoutFetcher.data.success) {
      showToast({
        icon,
        title: `Checkout completed`,
        status: 'success',
      });
    }
  }, [gitCheckoutFetcher.data, icon]);

  useEffect(() => {
    const errors = [...(gitFetchFetcher.data?.errors ?? [])];
    if (errors.length > 0) {
      setOperationError(errors.join('\n'));
      showToast({
        icon,
        title: `Fetch failed`,
        status: 'error',
      });
    } else if (gitFetchFetcher.data && 'success' in gitFetchFetcher.data && gitFetchFetcher.data.success) {
      showToast({
        icon,
        title: `Fetch completed`,
        status: 'success',
      });
    }
  }, [gitFetchFetcher.data, icon]);

  async function handlePush({ force }: { force: boolean }) {
    setOperationError(null);
    showToast({
      icon,
      title: `Push started`,
    });

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

  const isPushing = gitPushFetcher.state !== 'idle';
  const isFetching = gitFetchFetcher.state !== 'idle';
  const isCheckingOut = gitCheckoutFetcher.state !== 'idle';

  const isSyncing = isFetching || isCheckingOut;

  const isGitSyncDropdownDisabled = isSyncing || isPulling || isPushing;

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
              setOperationError(null);
              showToast({
                icon,
                title: `Pull started`,
              });

              const pullResult = await pullFromGitRemote({ projectId });

              if ('errors' in pullResult && pullResult.errors) {
                showToast({
                  icon,
                  title: `Pull failed`,
                  status: 'error',
                });
                setOperationError(pullResult.errors.join('\n'));
                setIsPulling(false);
              } else if ('conflicts' in pullResult) {
                showModal(SyncMergeModal, {
                  conflicts: pullResult.conflicts,
                  labels: pullResult.labels,
                  handleDone: (conflicts?: MergeConflict[]) => {
                    if (Array.isArray(conflicts) && conflicts.length > 0) {
                      setIsPulling(true);
                      continueMerge({
                        projectId,
                        handledMergeConflicts: conflicts,
                        commitMessage: pullResult.commitMessage,
                        commitParent: pullResult.commitParent,
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
                setIsPulling(false);
                showToast({
                  icon,
                  title: `Pull completed`,
                  status: 'success',
                });
                revalidate();
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : 'An error occurred while pulling';
              setOperationError(message);

              showToast({
                icon,
                title: `Pull failed`,
                status: 'error',
              });
            }
          },
        },
        {
          id: 'push',
          icon: 'cloud-upload',
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
          icon: 'refresh',
          isDisabled: false,
          label: 'Fetch',
          action: () => {
            setOperationError(null);
            showToast({
              icon,
              title: `Fetch started`,
            });
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
      gitIntervalFetchFetcher.submit(
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
          setOperationError(null);
          showToast({
            title: `Switching to branch ${branch}`,
          });
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
      {operationError && (
        <div className="flex gap-2 bg-[rgba(var(--color-danger-rgb),1)] px-2 py-1 text-xs text-[--color-font-danger]">
          <div className="flex items-center gap-2">
            <Icon icon="triangle-exclamation" />
            <span>{operationError}</span>
          </div>
          <Button onPress={() => setOperationError(null)} className="ml-auto">
            <Icon icon="xmark" className="mt-0.5" />
          </Button>
        </div>
      )}
      {!isSynced ? (
        <div className="flex h-[--line-height-sm] w-full items-center gap-2 px-[--padding-md] text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] disabled:opacity-100 aria-pressed:bg-[--hl-sm]">
          <Icon icon={icon} className="size-4" />
          <Separator orientation="vertical" className="h-4 border border-solid border-[--hl-sm] bg-[--color-bg]" />
          <div className="flex w-full items-center justify-between gap-2 truncate">
            <span className="truncate">Git is not connected</span>
            <Button
              onPress={() => setIsGitRepoSettingsModalOpen(true)}
              className="flex h-[25px] items-center justify-center gap-2 rounded-md border border-solid border-[--hl-md] bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] bg-opacity-100 px-4 py-2 text-sm font-semibold text-[--color-font-surprise] ring-1 ring-transparent transition-all hover:bg-opacity-80 focus:ring-inset focus:ring-[--hl-md] aria-pressed:opacity-80"
            >
              <Icon icon="plug" />
              <span className="text-[--color-font-secondary]">Connect</span>
            </Button>
          </div>
        </div>
      ) : (
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
              isDisabled={isGitSyncDropdownDisabled}
              data-testid="git-dropdown"
              aria-label="Git Sync"
              className="flex h-[--line-height-sm] w-full items-center gap-2 px-[--padding-md] text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] disabled:opacity-100 aria-pressed:bg-[--hl-sm]"
            >
              <Icon icon={icon} className="size-4" />
              <Separator orientation="vertical" className="h-4 border border-solid border-[--hl-sm] bg-[--color-bg]" />
              <div className="relative flex items-center">
                <Icon icon="code-branch" className="size-4" />
                {pendingChangesCount > 0 && (
                  <div className="absolute -bottom-2 -right-1 h-[12px] min-w-[12px] bg-[--color-surprise] px-[4px] text-center font-semibold text-[--color-font-surprise] [border-radius:20px] [font-size:6px] [line-height:12px]">
                    {pendingChangesCount}
                  </div>
                )}
              </div>
              <span className="flex-1 truncate">
                {isSynced ? currentBranch : gitRepoDataFetcher.state !== 'idle' ? 'Syncing...' : 'Not synced'}
              </span>
              <div className="flex flex-shrink-0 items-center gap-1.5 text-xs text-[--color-font-secondary]">
                {isSyncing && <Icon icon="spinner" className="w-3 animate-spin" />}
                {isPulling && (
                  <div className="flex items-center gap-0.5 overflow-hidden">
                    <Icon icon="arrow-down" className="animate-down-loop w-2" />
                  </div>
                )}
                {isPushing && (
                  <div className="flex items-center gap-0.5 overflow-hidden">
                    <Icon icon="arrow-up" className="animate-up-loop w-2" />
                  </div>
                )}
              </div>
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
      )}
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
