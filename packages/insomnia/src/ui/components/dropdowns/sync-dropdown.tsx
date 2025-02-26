import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import React, { type FC, Fragment, useCallback, useEffect, useState } from 'react';
import { Button, Collection, Menu, MenuItem, MenuTrigger, Popover, Section, Tooltip, TooltipTrigger } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';
import { useInterval } from 'react-use';

import * as session from '../../../account/session';
import { getAppWebsiteBaseURL } from '../../../common/constants';
import { isOwnerOfOrganization } from '../../../models/organization';
import type { Project } from '../../../models/project';
import type { Workspace } from '../../../models/workspace';
import { useOrganizationLoaderData } from '../../routes/organization';
import type { SyncDataLoaderData } from '../../routes/remote-collections';
import { useRootLoaderData } from '../../routes/root';
import { Icon } from '../icon';
import { showError, showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';
import { AskModal } from '../modals/ask-modal';
import { GitRepositorySettingsModal } from '../modals/git-repository-settings-modal';
import { SyncBranchesModal } from '../modals/sync-branches-modal';
import { SyncHistoryModal } from '../modals/sync-history-modal';
import { SyncStagingModal } from '../modals/sync-staging-modal';

interface Props {
  workspace: Workspace;
  project: Project;
  gitSyncEnabled: boolean;
}

const ONE_MINUTE_IN_MS = 1000 * 60;

export const SyncDropdown: FC<Props> = ({ gitSyncEnabled }) => {
  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();
  const { organizations } = useOrganizationLoaderData();
  const { userSession } = useRootLoaderData();
  const currentOrg = organizations.find(organization => (organization.id === organizationId));
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
      syncDataLoaderFetcher.load(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/sync-data`);
    }
  }, [organizationId, projectId, syncDataLoaderFetcher, workspaceId]);

  const triggerSync = useCallback(() => {
    const submit = syncDataActionFetcher.submit;
    submit({}, {
      method: 'POST',
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/sync-data`,
    });
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

  useInterval(() => {
    triggerSync();
  }, isWindowFocused ? ONE_MINUTE_IN_MS : null);

  const error = checkoutFetcher.data?.error || pullFetcher.data?.error || pushFetcher.data?.error || rollbackFetcher.data?.error;

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
      <Button className="flex items-center h-9 gap-4 px-[--padding-md] w-full aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
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
      checkoutFetcher.submit({
        branch,
      }, {
        method: 'POST',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/checkout`,
      });
    },
  }));

  const showUpgradePlanModal = () => {
    const accountId = session.getAccountId();
    if (!currentOrg || !accountId) {
      return;
    }
    const isOwner = isOwnerOfOrganization({
      organization: currentOrg,
      accountId: userSession.accountId,
    });

    isOwner ?
      showModal(AskModal, {
        title: 'Upgrade Plan',
        message: 'Git Sync is only enabled for Pro plan or above, please upgrade your plan.',
        yesText: 'Upgrade',
        noText: 'Cancel',
        onDone: async (isYes: boolean) => {
          if (isYes) {
            window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/subscription/update?plan=team`);
          }
        },
      }) : showModal(AlertModal, {
        title: 'Upgrade Plan',
        message: 'Git Sync is only enabled for Pro plan or above, please ask the organization owner to upgrade.',
      });
  };

  const switchToGitRepoActionList: {
    id: string;
    name: string;
    icon: IconProp;
    isDisabled?: boolean;
    action: () => void;
  }[] = [
      {
        id: 'switch-to-git-repo',
        name: 'Switch to Git Repository',
        icon: ['fab', 'git-alt'],
        action: () => gitSyncEnabled ? setIsGitRepoSettingsModalOpen(true) : showUpgradePlanModal(),
      },
    ];

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
          rollbackFetcher.submit({}, {
            method: 'POST',
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/rollback`,
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
        name: pullFetcher.state !== 'idle' ? 'Pulling...' : behind > 0 ? `Pull ${behind || ''} Commit${behind === 1 ? '' : 's'}` : 'Pull',
        icon: pullFetcher.state !== 'idle' ? 'refresh' : 'cloud-download',
        isDisabled: behind === 0 || pullFetcher.state !== 'idle',
        action: () => {
          pullFetcher.submit({}, {
            method: 'POST',
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/pull`,
          });
        },
      },
      {
        id: 'push',
        name: pushFetcher.state !== 'idle' ? 'Pushing...' : ahead > 0 ? `Push ${ahead || ''} Commit${ahead === 1 ? '' : 's'}` : 'Push',
        icon: pushFetcher.state !== 'idle' ? 'refresh' : 'cloud-upload',
        isDisabled: ahead === 0 || pushFetcher.state !== 'idle',
        action: () => {
          pushFetcher.submit({}, {
            method: 'POST',
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/push`,
          });
        },
      },
    ];

  const isSyncing = checkoutFetcher.state !== 'idle' || pullFetcher.state !== 'idle' || pushFetcher.state !== 'idle' || rollbackFetcher.state !== 'idle';

  const allSyncMenuActionList = [...switchToGitRepoActionList, ...localBranchesActionList, ...syncMenuActionList];
  const syncError = syncDataLoaderFetcher.data && 'error' in syncDataLoaderFetcher.data ? syncDataLoaderFetcher.data.error : null;
  return (
    <Fragment>
      <MenuTrigger>
        <div className="flex items-center h-[--line-height-sm] w-full aria-pressed:bg-[--hl-sm] text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
          <Button
            aria-label="Insomnia Sync"
            className="flex-1 flex h-full items-center gap-2 truncate px-[--padding-md]"
          >
            <Icon
              icon={syncError ? 'warning' : isSyncing ? 'refresh' : 'cloud'}
              className={`w-5 ${syncError ? 'text-[--color-warning]' : isSyncing ? 'animate-spin' : ''}`}
            />
            <span className={`truncate ${syncError ? 'text-[--color-warning]' : ''}`}>{syncError ? 'Error syncing with Insomnia Cloud' : currentBranch}</span>
          </Button>
          <div className="flex items-center h-full">
            <TooltipTrigger>
              <Button className="h-full pl-2">
                <Icon icon="cube" className={`transition-colors ${canCreateSnapshot ? 'text-[--color-warning]' : 'opacity-50'}`} />
              </Button>
              <Tooltip
                placement="top end"
                offset={8}
                className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
              >
                {snapshotToolTipMsg}
              </Tooltip>
            </TooltipTrigger>
            <TooltipTrigger>
              <Button className="h-full px-2">
                <Icon icon="cloud-download" className={`transition-colors ${canPull ? '' : 'opacity-50'} ${pullFetcher.state !== 'idle' ? 'animate-pulse' : ''}`} />
              </Button>
              <Tooltip
                placement="top end"
                offset={8}
                className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
              >
                {pullToolTipMsg}
              </Tooltip>
            </TooltipTrigger>

            <TooltipTrigger>
              <Button className="h-full pr-[--padding-md]">
                <Icon icon="cloud-upload" className={`transition-colors ${canPush ? '' : 'opacity-50'} ${pushFetcher.state !== 'idle' ? 'animate-pulse' : ''}`} />
              </Button>
              <Tooltip
                placement="top end"
                offset={8}
                className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
              >
                {pushToolTipMsg}
              </Tooltip>
            </TooltipTrigger>
          </div>
        </div>
        <Popover className="min-w-max max-w-lg overflow-hidden" placement='top end' offset={8}>
          <Menu
            aria-label="Insomnia Sync Menu"
            selectionMode="single"
            disabledKeys={allSyncMenuActionList.filter(item => item.isDisabled).map(item => item.id)}
            onAction={key => {
              const item = allSyncMenuActionList.find(item => item.id === key);
              item?.action();
            }}
            className="border max-w-lg select-none text-sm border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
          >
            <Section className='border-b border-solid border-[--hl-sm] pb-2'>
              <Collection items={switchToGitRepoActionList}>
                {item => (
                  <MenuItem
                    textValue={item.name}
                    className={'group aria-disabled:opacity-30 aria-disabled:cursor-not-allowed flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent disabled:cursor-not-allowed focus:outline-none transition-colors'}
                    aria-label={item.name}
                  >
                    <div className="px-4 text-[--color-font-surprise] w-full bg-opacity-100 bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:opacity-80 rounded-sm hover:bg-opacity-80 group-pressed:opacity-80 group-hover:bg-opacity-80 group-focus:bg-opacity-80 group-focus:ring-inset group-hover:ring-inset focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                      <Icon icon={item.icon} />
                      <div>{item.name}</div>
                    </div>
                  </MenuItem>
                )}
              </Collection>
            </Section>
            {syncError && (
              <Section className='border-b border-solid border-[--hl-sm]'>
                <MenuItem
                  className={'flex overflow-hidden gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] w-full text-md whitespace-nowrap bg-transparent disabled:cursor-not-allowed focus:outline-none transition-colors'}
                  aria-label={syncError}
                >
                  <Icon icon="exclamation-triangle" className="text-[--color-warning]" />
                  <p className='whitespace-normal'>{syncError}</p>
                </MenuItem>
              </Section>
            )}
            {!syncError && (
              <Fragment>
                <Section className='border-b border-solid border-[--hl-sm]'>
                  <Collection items={localBranchesActionList}>
                    {item => (
                      <MenuItem
                        className={`aria-disabled:opacity-30 aria-disabled:cursor-not-allowed flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors ${item.isActive ? 'font-bold' : ''}`}
                        aria-label={item.name}
                      >
                        <Icon icon={item.icon} className={item.isActive ? 'text-[--color-success]' : ''} />
                        <span className='truncate'>{item.name}</span>
                      </MenuItem>
                    )}
                  </Collection>
                </Section>
                <Section>
                  <Collection items={syncMenuActionList}>
                    {item => (
                      <MenuItem
                        className={'aria-disabled:opacity-30 aria-disabled:cursor-not-allowed flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors'}
                        aria-label={item.name}
                      >
                        <Icon icon={item.icon} />
                        <span>{item.name}</span>
                      </MenuItem>
                    )}
                  </Collection>
                </Section>
              </Fragment>
            )}
          </Menu>
        </Popover>
      </MenuTrigger>
      {isGitRepoSettingsModalOpen && (
        <GitRepositorySettingsModal
          onHide={() => setIsGitRepoSettingsModalOpen(false)}
        />
      )}
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
        <SyncHistoryModal
          history={history}
          onClose={() => setIsSyncHistoryModalOpen(false)}
        />
      )}
    </Fragment>
  );
};
