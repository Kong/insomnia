import type { IconName, IconProp } from '@fortawesome/fontawesome-svg-core';
import type { GitRepository } from 'insomnia-data';
import { type FC, useEffect, useState } from 'react';
import {
  Button,
  Collection,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import { useParams, useRevalidator } from 'react-router';
import * as reactUse from 'react-use';

import { useGitProjectCheckoutBranchActionFetcher } from '~/routes/git.branch.checkout';
import { useGitProjectFetchActionFetcher } from '~/routes/git.fetch';
import { useGitProjectPushActionFetcher } from '~/routes/git.push';
import { useGitProjectRepoFetcher } from '~/routes/git.repo';
import { useGitProjectResetActionFetcher } from '~/routes/git.reset';
import { useGitProjectStatusActionFetcher } from '~/routes/git.status';
import { getOauth2FormatName } from '~/sync/git/get-oauth2-format-name';

import type { MergeConflict } from '../../../sync/types';
import { ConfigLink } from '../github-app-config-link';
import { Icon } from '../icon';
import { showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';
import { GitBranchesModal } from '../modals/git-branches-modal';
import { GitLogModal } from '../modals/git-log-modal';
import { GitRepositorySettingsModal } from '../modals/git-repository-settings-modal';
import { GitStagingModal } from '../modals/git-staging-modal';
import { SyncMergeModal } from '../modals/sync-merge-modal';

interface Props {
  gitRepository: GitRepository;
  isInsomniaSyncEnabled: boolean;
  showDeprecatedWarning: boolean;
}

export const GitSyncDropdown: FC<Props> = ({ gitRepository, isInsomniaSyncEnabled, showDeprecatedWarning }) => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const [isGitRepoSettingsModalOpen, setIsGitRepoSettingsModalOpen] = useState(false);
  const [isGitBranchesModalOpen, setIsGitBranchesModalOpen] = useState(false);
  const [isGitLogModalOpen, setIsGitLogModalOpen] = useState(false);
  const [isGitStagingModalOpen, setIsGitStagingModalOpen] = useState(false);

  const gitPushFetcher = useGitProjectPushActionFetcher();
  const gitCheckoutFetcher = useGitProjectCheckoutBranchActionFetcher();
  const gitRepoDataFetcher = useGitProjectRepoFetcher();
  const gitFetchFetcher = useGitProjectFetchActionFetcher();
  const gitStatusFetcher = useGitProjectStatusActionFetcher();
  const resetGitStatusFetcher = useGitProjectResetActionFetcher();

  const loadingPush = gitPushFetcher.state === 'loading';
  const loadingFetch = gitFetchFetcher.state === 'loading';
  const loadingStatus = gitStatusFetcher.state === 'loading';

  const [isPulling, setIsPulling] = useState(false);

  useEffect(() => {
    if (gitRepository?.uri && gitRepository?._id && gitRepoDataFetcher.state === 'idle' && !gitRepoDataFetcher.data) {
      gitRepoDataFetcher.load({
        projectId,
        workspaceId,
      });
    }
  }, [gitRepoDataFetcher, gitRepository?.uri, gitRepository?._id, organizationId, projectId, workspaceId]);

  // Only fetch the repo status if we have a repo uri and we don't have the status already
  const shouldFetchGitRepoStatus = Boolean(
    gitRepository?.uri &&
      gitRepository?._id &&
      gitStatusFetcher.state === 'idle' &&
      !gitStatusFetcher.data &&
      gitRepoDataFetcher.data,
  );

  useEffect(() => {
    if (shouldFetchGitRepoStatus) {
      gitStatusFetcher.submit({
        projectId,
        workspaceId,
      });
    }
  }, [gitStatusFetcher, organizationId, projectId, shouldFetchGitRepoStatus, workspaceId]);

  useEffect(() => {
    const errors = [...(gitPushFetcher.data?.errors ?? [])];
    if (errors.length > 0) {
      showModal(AlertModal, {
        title: 'Push Failed',
        message: (
          <>
            {errors.join('\n')}
            <ConfigLink {...gitPushFetcher.data} />
          </>
        ),
      });
    }
  }, [gitPushFetcher.data]);

  useEffect(() => {
    const gitRepoDataErrors =
      gitRepoDataFetcher.data && 'errors' in gitRepoDataFetcher.data && gitRepoDataFetcher.data.errors
        ? gitRepoDataFetcher.data.errors
        : [];
    const errors = [...gitRepoDataErrors];
    if (errors.length > 0) {
      if (isGitRepoSettingsModalOpen) {
        // user just clicked 'Reset'
        return;
      }
      showModal(AlertModal, {
        title: 'Loading of Git Repository Failed',
        message: errors.join('\n'),
      });
    }
  }, [isGitRepoSettingsModalOpen, gitRepoDataFetcher.data]);

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
    gitPushFetcher.submit({
      projectId,
      workspaceId,
      force,
    });
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
              await window.main.git
                .pullFromGitRemote({ projectId, workspaceId })
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
                      onResolveAll: (conflicts: MergeConflict[]) => {
                        setIsPulling(true);
                        window.main.git
                          .continueMerge({
                            projectId,
                            workspaceId,
                            handledMergeConflicts: conflicts,
                            autoResolvedConflicts: result.autoResolvedConflicts,
                            commitMessage: result.commitMessage,
                            commitParent: result.commitParent,
                          })
                          .finally(() => {
                            setIsPulling(false);
                            revalidate();
                          });
                      },
                    });
                  }
                })
                .finally(() => {
                  setIsPulling(false);
                  revalidate();
                });
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : 'An error occurred while pulling';
              showModal(AlertModal, {
                title: 'Pull Failed',
                message: (
                  <>
                    {errorMessage}
                    <ConfigLink {...{ gitRepository, errors: [errorMessage] }} />
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
            gitFetchFetcher.submit({
              projectId,
              workspaceId,
            });
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

  reactUse.useInterval(
    () => {
      gitFetchFetcher.submit({
        projectId,
        workspaceId,
      });
    },
    1000 * 60 * 5,
  );

  const status = gitStatusFetcher.data?.status;

  const commitToolTipMsg = status?.localChanges ? 'Local changes made' : 'No local changes made';

  const switchToInsomniaSyncList: {
    id: string;
    label: string;
    icon: IconProp;
    isDisabled?: boolean;
    action: () => void;
  }[] = isInsomniaSyncEnabled
    ? [
        {
          id: 'switch-to-git-repo',
          label: 'Switch to Insomnia Sync',
          icon: 'cloud',
          action: async () => {
            resetGitStatusFetcher.submit({
              projectId,
              workspaceId,
            });
          },
        },
      ]
    : [];

  const branchesActionList: {
    id: string;
    label: string;
    icon: IconName;
    isDisabled?: boolean;
    isActive: boolean;
    action: () => void;
  }[] =
    isSynced && branches
      ? branches.map(branch => ({
          id: branch,
          label: branch,
          isActive: branch === currentBranch,
          icon: 'code-branch',
          action: async () => {
            gitCheckoutFetcher.submit({
              projectId,
              workspaceId,
              branch,
            });
          },
        }))
      : [];

  const allSyncMenuActionList = [
    ...switchToInsomniaSyncList,
    ...gitSyncActions,
    ...branchesActionList,
    ...currentBranchActions,
  ];

  return (
    <>
      {showDeprecatedWarning && (
        <div className="p-(--padding-sm)">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-solid border-(--hl-md) bg-(--color-warning)/50 p-(--padding-xs) text-(--color-font-warning)">
            <p className="text-sm">
              <Icon icon="exclamation-triangle" className="mr-2" />
              You are using the legacy Git integration in this project, learn more about converting to the new Git Sync
              capability.{' '}
              <Button
                className="underline"
                onPress={() => window.main.openInBrowser('https://docs.insomnia.rest/insomnia/git-sync')}
              >
                Migration Guide
              </Button>
            </p>
          </div>
        </div>
      )}
      <MenuTrigger>
        <div className="flex h-(--line-height-sm) w-full items-center text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)">
          <Button
            data-testid="git-dropdown"
            aria-label="Git Sync"
            className="flex h-full flex-1 items-center gap-2 truncate px-(--padding-md)"
          >
            <Icon icon={isLoading ? 'refresh' : iconClassName} className={`w-5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="truncate">{isSynced ? currentBranch : 'Not synced'}</span>
          </Button>
          <TooltipTrigger>
            <Button className={`h-full px-(--padding-md) ${status?.localChanges ? 'text-(--color-warning)' : ''}`}>
              <Icon
                icon={loadingStatus ? 'refresh' : 'cube'}
                className={`transition-colors ${isLoading ? 'animate-pulse' : loadingStatus ? 'animate-spin' : ''}`}
              />
            </Button>
            <Tooltip
              placement="top end"
              offset={8}
              className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
            >
              {commitToolTipMsg}
            </Tooltip>
          </TooltipTrigger>
        </div>
        <Popover className="max-w-lg min-w-max overflow-hidden" placement="top end" offset={8}>
          <Menu
            aria-label="Git Sync Menu"
            selectionMode="single"
            disabledKeys={allSyncMenuActionList.filter(item => item?.isDisabled).map(item => item.id)}
            onAction={key => {
              const item = allSyncMenuActionList.find(item => item.id === key);
              item?.action();
            }}
            className="max-h-[85vh] max-w-lg overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
          >
            <MenuSection className="border-b border-solid border-(--hl-sm) pb-2 empty:border-none empty:pb-0">
              <Collection items={switchToInsomniaSyncList}>
                {item => (
                  <MenuItem
                    textValue={item.label}
                    className={
                      'group flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors focus:outline-hidden disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-selected:font-bold'
                    }
                    aria-label={item.label}
                  >
                    <div className="group-pressed:opacity-80 flex w-full items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-1 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all group-hover:bg-(--color-surprise)/80 group-hover:ring-inset group-focus:bg-(--color-surprise)/80 group-focus:ring-inset hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80">
                      <Icon icon={item.icon} />
                      <div>{item.label}</div>
                    </div>
                  </MenuItem>
                )}
              </Collection>
            </MenuSection>
            <MenuSection className="border-b border-solid border-(--hl-sm) pb-2 empty:border-none empty:pb-0">
              <Collection items={gitSyncActions}>
                {item => (
                  <MenuItem
                    className={
                      'flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-selected:font-bold'
                    }
                    aria-label={item.label}
                  >
                    <Icon icon={item.icon} />
                    <span>{item.label}</span>
                  </MenuItem>
                )}
              </Collection>
            </MenuSection>
            <MenuSection className="border-b border-solid border-(--hl-sm) pb-2 empty:border-none empty:pb-0">
              <Collection items={branchesActionList}>
                {item => (
                  <MenuItem
                    className={`flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-selected:font-bold ${item.isActive ? 'font-bold' : ''}`}
                    aria-label={item.label}
                  >
                    <Icon icon={item.icon} className={item.isActive ? 'text-(--color-success)' : ''} />
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
                      'flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-selected:font-bold'
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
        <GitRepositorySettingsModal gitRepository={gitRepository} onHide={() => setIsGitRepoSettingsModalOpen(false)} />
      )}
      {isGitBranchesModalOpen && gitRepository && (
        <GitBranchesModal
          onClose={() => setIsGitBranchesModalOpen(false)}
          currentBranch={currentBranch ?? ''}
          branches={branches ?? []}
        />
      )}
      {isGitLogModalOpen && gitRepository && <GitLogModal onClose={() => setIsGitLogModalOpen(false)} />}
      {isGitStagingModalOpen && gitRepository && <GitStagingModal onClose={() => setIsGitStagingModalOpen(false)} />}
    </>
  );
};
