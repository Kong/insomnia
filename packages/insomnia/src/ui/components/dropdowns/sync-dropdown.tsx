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
  Separator,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import { useParams } from 'react-router';
import * as reactUse from 'react-use';

import { useInsomniaSyncBranchCheckoutActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.branch.checkout';
import { useInsomniaSyncPullActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.pull';
import { useInsomniaSyncPushActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.push';
import { useInsomniaSyncRollbackActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.rollback';
import {
  useInsomniaSyncDataActionFetcher,
  useInsomniaSyncDataLoaderFetcher,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.sync-data';

import type { Project } from '../../../models/project';
import type { Workspace } from '../../../models/workspace';
import { Icon } from '../icon';
import { GitRepositorySettingsModal } from '../modals/git-repository-settings-modal';
import { SyncBranchesModal } from '../modals/sync-branches-modal';
import { SyncHistoryModal } from '../modals/sync-history-modal';
import { SyncStagingModal } from '../modals/sync-staging-modal';
import { showToast } from '../toast-notification';

interface Props {
  workspace: Workspace;
  project: Project;
}

const ONE_MINUTE_IN_MS = 1000 * 60;
const cloudSyncIcon = 'earth-americas';

export const SyncDropdown: FC<Props> = () => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const [isGitRepoSettingsModalOpen, setIsGitRepoSettingsModalOpen] = useState(false);
  const [isSyncHistoryModalOpen, setIsSyncHistoryModalOpen] = useState(false);
  const [isSyncStagingModalOpen, setIsSyncStagingModalOpen] = useState(false);
  const [isSyncBranchesModalOpen, setIsSyncBranchesModalOpen] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [operationError, setOperationError] = useState<string | null>(null);

  const pushFetcher = useInsomniaSyncPushActionFetcher();
  const pullFetcher = useInsomniaSyncPullActionFetcher();
  const rollbackFetcher = useInsomniaSyncRollbackActionFetcher();
  const checkoutFetcher = useInsomniaSyncBranchCheckoutActionFetcher();
  const syncDataLoaderFetcher = useInsomniaSyncDataLoaderFetcher();
  const syncDataActionFetcher = useInsomniaSyncDataActionFetcher();

  useEffect(() => {
    if (syncDataLoaderFetcher.state === 'idle' && !syncDataLoaderFetcher.data) {
      syncDataLoaderFetcher.load({
        organizationId,
        projectId,
        workspaceId,
      });
    }
  }, [organizationId, projectId, syncDataLoaderFetcher, workspaceId]);

  const triggerSync = useCallback(() => {
    const submit = syncDataActionFetcher.submit;
    submit({ organizationId, projectId, workspaceId });
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

  useEffect(() => {
    if (checkoutFetcher.data && 'error' in checkoutFetcher.data && checkoutFetcher.data.error) {
      setOperationError(checkoutFetcher.data.error);
      showToast({
        icon: cloudSyncIcon,
        title: `Checkout failed`,
        status: 'error',
      });
    } else if (checkoutFetcher.data && 'success' in checkoutFetcher.data && checkoutFetcher.data.success) {
      showToast({
        icon: cloudSyncIcon,
        title: `Checkout completed`,
        status: 'success',
      });
    }
  }, [checkoutFetcher.data]);

  useEffect(() => {
    if (pushFetcher.data && 'error' in pushFetcher.data && pushFetcher.data.error) {
      setOperationError(pushFetcher.data.error);
      showToast({ icon: cloudSyncIcon, title: `Push failed` });
    } else if (pushFetcher.data && 'success' in pushFetcher.data && pushFetcher.data.success) {
      showToast({
        icon: cloudSyncIcon,
        title: `Push completed`,
        status: 'success',
      });
    }
  }, [pushFetcher.data]);

  useEffect(() => {
    if (pullFetcher.data && 'error' in pullFetcher.data && pullFetcher.data.error) {
      setOperationError(pullFetcher.data.error);
      showToast({ icon: cloudSyncIcon, title: `Pull failed` });
    } else if (pullFetcher.data && 'success' in pullFetcher.data && pullFetcher.data.success) {
      showToast({
        icon: cloudSyncIcon,
        title: `Pull completed`,
        status: 'success',
      });
    }
  }, [pullFetcher.data]);

  useEffect(() => {
    if (rollbackFetcher.data && 'error' in rollbackFetcher.data && rollbackFetcher.data.error) {
      setOperationError(rollbackFetcher.data.error);
      showToast({
        icon: cloudSyncIcon,
        title: `Rollback failed`,
        status: 'error',
      });
    } else if (rollbackFetcher.data && 'success' in rollbackFetcher.data && rollbackFetcher.data.success) {
      showToast({
        icon: cloudSyncIcon,
        title: `Rollback completed`,
        status: 'success',
      });
    }
  }, [rollbackFetcher.data]);

  reactUse.useInterval(
    () => {
      triggerSync();
    },
    isWindowFocused ? ONE_MINUTE_IN_MS : null,
  );

  const {
    status,
    localBranches = [],
    remoteBranches = [],
    currentBranch = '',
    historyCount = 0,
    history = [],
    syncItems = [],
    compare = { ahead: 0, behind: 0 },
  } = syncDataLoaderFetcher.data || {
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

  const canCreateSnapshot =
    Object.keys(status?.stage || {}).length > 0 || Object.keys(status?.unstaged || {}).length > 0;

  const pullCount = compare?.behind || 0;
  const pushCount = compare?.ahead || 0;
  const canPush = compare?.ahead && compare.ahead > 0;
  const canPull = compare?.behind && compare.behind > 0;
  const pullToolTipMsg = canPull
    ? `There ${compare.behind === 1 ? 'is' : 'are'} ${compare.behind} commit${compare.behind === 1 ? '' : 's'} to pull`
    : 'No changes to pull';
  const pushToolTipMsg = canPush
    ? `There ${compare.ahead === 1 ? 'is' : 'are'} ${compare.ahead} commit${compare.ahead === 1 ? '' : 's'} to push`
    : 'No changes to push';

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
      setOperationError(null);
      showToast({ icon: cloudSyncIcon, title: `Checking out branch ${branch}` });
      checkoutFetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        branch,
      });
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
        setOperationError(null);
        showToast({ icon: cloudSyncIcon, title: `Rollback started` });

        rollbackFetcher.submit({
          organizationId,
          projectId,
          workspaceId,
        });
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
          : compare.behind > 0
            ? `Pull ${compare.behind || ''} Commit${compare.behind === 1 ? '' : 's'}`
            : 'Pull',
      icon: pullFetcher.state !== 'idle' ? 'refresh' : 'cloud-download',
      isDisabled: compare.behind === 0 || pullFetcher.state !== 'idle',
      action: () => {
        setOperationError(null);
        showToast({
          icon: cloudSyncIcon,
          title: `Pull failed`,
          status: 'error',
        });
        pullFetcher.submit({
          organizationId,
          projectId,
          workspaceId,
        });
      },
    },
    {
      id: 'push',
      name:
        pushFetcher.state !== 'idle'
          ? 'Pushing...'
          : compare.ahead > 0
            ? `Push ${compare.ahead || ''} Commit${compare.ahead === 1 ? '' : 's'}`
            : 'Push',
      icon: pushFetcher.state !== 'idle' ? 'refresh' : 'cloud-upload',
      isDisabled: compare.ahead === 0 || pushFetcher.state !== 'idle',
      action: () => {
        setOperationError(null);
        showToast({ icon: cloudSyncIcon, title: `Push started` });

        pushFetcher.submit({
          organizationId,
          projectId,
          workspaceId,
        });
      },
    },
  ];

  const isPulling = pullFetcher.state !== 'idle';
  const isPushing = pushFetcher.state !== 'idle';
  const isRollingBack = rollbackFetcher.state !== 'idle';
  const isCheckingOut = checkoutFetcher.state !== 'idle';
  const isSyncing = isRollingBack || isCheckingOut;

  const allSyncMenuActionList = [...localBranchesActionList, ...syncMenuActionList];
  const syncError =
    syncDataLoaderFetcher.data && 'error' in syncDataLoaderFetcher.data ? syncDataLoaderFetcher.data.error : null;
  const isGitDropdownDisabled = isSyncing || isPulling || isPushing;

  return (
    <Fragment>
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
      <MenuTrigger>
        <TooltipTrigger delay={0}>
          <Button
            isDisabled={isGitDropdownDisabled}
            data-testid="git-dropdown"
            aria-label="Git Sync"
            className="flex h-[--line-height-sm] w-full items-center gap-2 px-[--padding-md] text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] disabled:opacity-100 aria-pressed:bg-[--hl-sm]"
          >
            <Icon icon="earth-americas" className="size-4" />
            <Separator orientation="vertical" className="h-4 border border-solid border-[--hl-sm] bg-[--color-bg]" />
            <div className="relative flex items-center">
              <Icon icon="code-branch" className="size-4" />
              {canCreateSnapshot && (
                <div className="absolute -bottom-1 -right-1 size-[10px] rounded-full bg-[--color-surprise]" />
              )}
            </div>
            <span className="flex-1 truncate">{syncError ? 'Error syncing with Insomnia Cloud' : currentBranch}</span>
            <div className="flex flex-shrink-0 items-center gap-1.5 text-xs text-[--color-font-secondary]">
              {isSyncing && <Icon icon="spinner" className="w-3 animate-spin" />}
              <div className="flex items-center gap-0.5 overflow-hidden">
                <span>{pullCount}</span>
                <Icon icon="arrow-down" className={`w-2 ${isPulling && 'animate-down-loop'}`} />
              </div>
              <div className="flex items-center gap-0.5 overflow-hidden">
                <span>{pushCount}</span>
                <Icon icon="arrow-up" className={`w-2 ${isPushing && 'animate-up-loop'}`} />
              </div>
            </div>
          </Button>
          <Tooltip
            offset={8}
            className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
          >
            <div className="flex flex-col gap-1">
              <div>Encrypted and synced securely to the cloud. Ideal for out of the box collaboration.</div>
              {canCreateSnapshot && (
                <div className="flex items-center gap-2">
                  <div className="size-[10px] rounded-full bg-[--color-surprise]" />
                  There are pending changes to commit.
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  <span>{pullCount}</span>
                  <Icon icon="arrow-down" className="w-2" />
                </div>
                {pullToolTipMsg}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  <span>{pushCount}</span>
                  <Icon icon="arrow-up" className="w-2" />
                </div>
                {pushToolTipMsg}
              </div>
              <div className="text-[--color-warning]">{syncError ? `Error: ${syncError}` : ''}</div>
            </div>
          </Tooltip>
        </TooltipTrigger>

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
                    'flex w-full items-center gap-2 overflow-hidden whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors focus:outline-none disabled:cursor-not-allowed aria-selected:font-bold'
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
                        className={`flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-selected:font-bold ${item.isActive ? 'font-bold' : ''}`}
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
                          'flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-selected:font-bold'
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
      {isSyncStagingModalOpen && status && (
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
