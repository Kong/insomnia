import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import React, { type FC, Fragment, useCallback, useEffect, useState } from 'react';
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
import { useFetcher, useParams } from 'react-router';
import { useInterval } from 'react-use';

import type { Project } from '../../../models/project';
import type { Workspace } from '../../../models/workspace';
import type { SyncDataLoaderData } from '../../routes/remote-collections';
import { Icon } from '../icon';
import { showError } from '../modals';
import { GitRepositorySettingsModal } from '../modals/git-repository-settings-modal';
import { SyncBranchesModal } from '../modals/sync-branches-modal';
import { SyncHistoryModal } from '../modals/sync-history-modal';
import { SyncStagingModal } from '../modals/sync-staging-modal';

interface Props {
  workspace: Workspace;
  project: Project;
}

const ONE_MINUTE_IN_MS = 1000 * 60;

export const SyncDropdown: FC<Props> = () => {
  const { organizationId, projectId, workspaceId } = useParams<{
    organizationId: string;
    projectId: string;
    workspaceId: string;
  }>();

  const [isGitRepoSettingsModalOpen, setIsGitRepoSettingsModalOpen] = useState(false);
  const [isSyncHistoryModalOpen, setIsSyncHistoryModalOpen] = useState(false);
  const [isSyncStagingModalOpen, setIsSyncStagingModalOpen] = useState(false);
  const [isSyncBranchesModalOpen, setIsSyncBranchesModalOpen] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  const pushFetcher = useFetcher();
  const pullFetcher = useFetcher();
  const rollbackFetcher = useFetcher();
  const checkoutFetcher = useFetcher();
  const syncDataLoaderFetcher = useFetcher<SyncDataLoaderData>();
  const syncDataActionFetcher = useFetcher();

  useEffect(() => {
    if (syncDataLoaderFetcher.state === 'idle' && !syncDataLoaderFetcher.data) {
      syncDataLoaderFetcher.load(
        `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/sync-data`,
      );
    }
  }, [organizationId, projectId, syncDataLoaderFetcher, workspaceId]);

  const triggerSync = useCallback(() => {
    const submit = syncDataActionFetcher.submit;
    submit(
      {},
      {
        method: 'POST',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/sync-data`,
      },
    );
  }, [organizationId, projectId, syncDataActionFetcher.submit, workspaceId]);

  useEffect(() => {
    const unsubscribe = window.main.on('mainWindowFocusChange', (_, isFocus) => {
      setIsWindowFocused(isFocus);
      if (isFocus) {
        // trigger sync when user comes back to the app
        triggerSync();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [triggerSync]);

  useInterval(
    () => {
      triggerSync();
    },
    isWindowFocused ? ONE_MINUTE_IN_MS : null,
  );

  const error =
    checkoutFetcher.data?.error || pullFetcher.data?.error || pushFetcher.data?.error || rollbackFetcher.data?.error;

  useEffect(() => {
    if (error) {
      showError({
        title: 'Sync Error',
        message: error,
      });
    }
  }, [error]);

  if (syncDataLoaderFetcher.state !== 'idle' && !syncDataLoaderFetcher.data) {
    return (
      <Button className="flex h-9 w-full items-center gap-4 rounded-sm px-[--padding-md] text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]">
        <Icon icon="refresh" className="animate-spin" /> Initializing
      </Button>
    );
  }

  let syncData: Extract<SyncDataLoaderData, { historyCount: number }> = {
    status: {
      stage: {},
      unstaged: {},
      key: '',
    },
    localBranches: [],
    remoteBranches: [],
    currentBranch: '',
    historyCount: 0,
    history: [],
    syncItems: [],
    compare: { ahead: 0, behind: 0 },
  };

  if (syncDataLoaderFetcher.data && !('error' in syncDataLoaderFetcher.data)) {
    syncData = syncDataLoaderFetcher.data;
  }

  const {
    status,
    localBranches,
    remoteBranches,
    currentBranch,
    historyCount,
    history,
    syncItems,
    compare: { ahead, behind },
  } = syncData;

  const canCreateSnapshot = Object.keys(status.stage).length > 0 || Object.keys(status.unstaged).length > 0;

  const canPush = ahead > 0;
  const canPull = behind > 0;
  const pullToolTipMsg = canPull
    ? `There ${behind === 1 ? 'is' : 'are'} ${behind} commit${behind === 1 ? '' : 's'} to pull`
    : 'No changes to pull';
  const pushToolTipMsg = canPush
    ? `There ${ahead === 1 ? 'is' : 'are'} ${ahead} commit${ahead === 1 ? '' : 's'} to push`
    : 'No changes to push';
  const snapshotToolTipMsg = canCreateSnapshot ? 'Local changes made' : 'No local changes made';

  const localBranchesActionList: {
    id: string;
    name: string;
    icon: IconProp;
    isDisabled?: boolean;
    isActive?: boolean;
    action: () => void;
  }[] = localBranches.map(branch => ({
    id: `checkout-${branch}`,
    name: branch,
    icon: 'code-branch',
    isActive: branch === currentBranch,
    action: () => {
      checkoutFetcher.submit(
        {
          branch,
        },
        {
          method: 'POST',
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/checkout`,
        },
      );
    },
  }));

  const syncMenuActionList: {
    id: string;
    name: string;
    icon: IconProp;
    isDisabled?: boolean;
    action: () => void;
  }[] = [
    {
      id: 'branches',
      name: 'Branches',
      icon: 'code-fork',
      action: () => setIsSyncBranchesModalOpen(true),
    },
    {
      id: 'history',
      name: 'History',
      icon: 'clock',
      isDisabled: historyCount === 0,
      action: () => setIsSyncHistoryModalOpen(true),
    },
    {
      id: 'revert',
      name: 'Discard all changes',
      icon: 'undo',
      isDisabled: historyCount === 0 || rollbackFetcher.state !== 'idle' || !canCreateSnapshot,
      action: () => {
        rollbackFetcher.submit(
          {},
          {
            method: 'POST',
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/rollback`,
          },
        );
      },
    },
    {
      id: 'commit',
      name: 'Commit',
      icon: 'cube',
      isDisabled: !canCreateSnapshot || rollbackFetcher.state !== 'idle',
      action: () => setIsSyncStagingModalOpen(true),
    },
    {
      id: 'pull',
      name:
        pullFetcher.state !== 'idle'
          ? 'Pulling...'
          : behind > 0
            ? `Pull ${behind || ''} Commit${behind === 1 ? '' : 's'}`
            : 'Pull',
      icon: pullFetcher.state !== 'idle' ? 'refresh' : 'cloud-download',
      isDisabled: behind === 0 || pullFetcher.state !== 'idle',
      action: () => {
        pullFetcher.submit(
          {},
          {
            method: 'POST',
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/pull`,
          },
        );
      },
    },
    {
      id: 'push',
      name:
        pushFetcher.state !== 'idle'
          ? 'Pushing...'
          : ahead > 0
            ? `Push ${ahead || ''} Commit${ahead === 1 ? '' : 's'}`
            : 'Push',
      icon: pushFetcher.state !== 'idle' ? 'refresh' : 'cloud-upload',
      isDisabled: ahead === 0 || pushFetcher.state !== 'idle',
      action: () => {
        pushFetcher.submit(
          {},
          {
            method: 'POST',
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/push`,
          },
        );
      },
    },
  ];

  const isSyncing =
    checkoutFetcher.state !== 'idle' ||
    pullFetcher.state !== 'idle' ||
    pushFetcher.state !== 'idle' ||
    rollbackFetcher.state !== 'idle';

  const allSyncMenuActionList = [...localBranchesActionList, ...syncMenuActionList];
  const syncError =
    syncDataLoaderFetcher.data && 'error' in syncDataLoaderFetcher.data ? syncDataLoaderFetcher.data.error : null;
  return (
    <Fragment>
      <MenuTrigger>
        <div className="flex h-[--line-height-sm] w-full items-center text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]">
          <Button
            aria-label="Insomnia Sync"
            className="flex h-full flex-1 items-center gap-2 truncate px-[--padding-md]"
          >
            <Icon
              icon={syncError ? 'warning' : isSyncing ? 'refresh' : 'cloud'}
              className={`w-5 ${syncError ? 'text-[--color-warning]' : isSyncing ? 'animate-spin' : ''}`}
            />
            <span className={`truncate ${syncError ? 'text-[--color-warning]' : ''}`}>
              {syncError ? 'Error syncing with Insomnia Cloud' : currentBranch}
            </span>
          </Button>
          <div className="flex h-full items-center">
            <TooltipTrigger>
              <Button className="h-full pl-2">
                <Icon
                  icon="cube"
                  className={`transition-colors ${canCreateSnapshot ? 'text-[--color-warning]' : 'opacity-50'}`}
                />
              </Button>
              <Tooltip
                placement="top end"
                offset={8}
                className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
              >
                {snapshotToolTipMsg}
              </Tooltip>
            </TooltipTrigger>
            <TooltipTrigger>
              <Button className="h-full px-2">
                <Icon
                  icon="cloud-download"
                  className={`transition-colors ${canPull ? '' : 'opacity-50'} ${pullFetcher.state !== 'idle' ? 'animate-pulse' : ''}`}
                />
              </Button>
              <Tooltip
                placement="top end"
                offset={8}
                className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
              >
                {pullToolTipMsg}
              </Tooltip>
            </TooltipTrigger>

            <TooltipTrigger>
              <Button className="h-full pr-[--padding-md]">
                <Icon
                  icon="cloud-upload"
                  className={`transition-colors ${canPush ? '' : 'opacity-50'} ${pushFetcher.state !== 'idle' ? 'animate-pulse' : ''}`}
                />
              </Button>
              <Tooltip
                placement="top end"
                offset={8}
                className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
              >
                {pushToolTipMsg}
              </Tooltip>
            </TooltipTrigger>
          </div>
        </div>
        <Popover className="min-w-max max-w-lg overflow-hidden" placement="top end" offset={8}>
          <Menu
            aria-label="Insomnia Sync Menu"
            selectionMode="single"
            disabledKeys={allSyncMenuActionList.filter(item => item.isDisabled).map(item => item.id)}
            onAction={key => {
              const item = allSyncMenuActionList.find(item => item.id === key);
              item?.action();
            }}
            className="max-h-[85vh] max-w-lg select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] py-2 text-sm shadow-lg focus:outline-none"
          >
            {syncError && (
              <MenuSection className="border-b border-solid border-[--hl-sm]">
                <MenuItem
                  className={
                    'text-md flex w-full items-center gap-2 overflow-hidden whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors focus:outline-none disabled:cursor-not-allowed aria-selected:font-bold'
                  }
                  aria-label={syncError}
                >
                  <Icon icon="exclamation-triangle" className="text-[--color-warning]" />
                  <p className="whitespace-normal">{syncError}</p>
                </MenuItem>
              </MenuSection>
            )}
            {!syncError && (
              <Fragment>
                <MenuSection className="border-b border-solid border-[--hl-sm]">
                  <Collection items={localBranchesActionList}>
                    {item => (
                      <MenuItem
                        className={`text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-selected:font-bold ${item.isActive ? 'font-bold' : ''}`}
                        aria-label={item.name}
                      >
                        <Icon icon={item.icon} className={item.isActive ? 'text-[--color-success]' : ''} />
                        <span className="truncate">{item.name}</span>
                      </MenuItem>
                    )}
                  </Collection>
                </MenuSection>
                <MenuSection>
                  <Collection items={syncMenuActionList}>
                    {item => (
                      <MenuItem
                        className={
                          'text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-selected:font-bold'
                        }
                        aria-label={item.name}
                      >
                        <Icon icon={item.icon} />
                        <span>{item.name}</span>
                      </MenuItem>
                    )}
                  </Collection>
                </MenuSection>
              </Fragment>
            )}
          </Menu>
        </Popover>
      </MenuTrigger>
      {isGitRepoSettingsModalOpen && <GitRepositorySettingsModal onHide={() => setIsGitRepoSettingsModalOpen(false)} />}
      {isSyncBranchesModalOpen && (
        <SyncBranchesModal
          branches={localBranches}
          currentBranch={currentBranch}
          remoteBranches={remoteBranches.filter(remoteBranch => !localBranches.includes(remoteBranch))}
          onClose={() => {
            setIsSyncBranchesModalOpen(false);
          }}
        />
      )}
      {isSyncStagingModalOpen && (
        <SyncStagingModal
          branch={currentBranch}
          status={status}
          syncItems={syncItems}
          onClose={() => setIsSyncStagingModalOpen(false)}
        />
      )}
      {isSyncHistoryModalOpen && (
        <SyncHistoryModal history={history} onClose={() => setIsSyncHistoryModalOpen(false)} />
      )}
    </Fragment>
  );
};
