import { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { FC, Fragment, useEffect, useState } from 'react';
import { Button, Item, Menu, MenuTrigger, Popover, Tooltip, TooltipTrigger } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';

import * as session from '../../../account/session';
import { Project } from '../../../models/project';
import type { Workspace } from '../../../models/workspace';
import { VCS } from '../../../sync/vcs/vcs';
import { SyncDataLoaderData } from '../../routes/remote-collections';
import { Icon } from '../icon';
import { GitRepositorySettingsModal } from '../modals/git-repository-settings-modal';
import { SyncBranchesModal } from '../modals/sync-branches-modal';
import { SyncDeleteModal } from '../modals/sync-delete-modal';
import { SyncHistoryModal } from '../modals/sync-history-modal';
import { SyncStagingModal } from '../modals/sync-staging-modal';

interface Props {
  workspace: Workspace;
  project: Project;
  vcs: VCS;
}

export const SyncDropdown: FC<Props> = ({ vcs }) => {
  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();

  const [isGitRepoSettingsModalOpen, setIsGitRepoSettingsModalOpen] = useState(false);
  const [isSyncDeleteModalOpen, setIsSyncDeleteModalOpen] = useState(false);
  const [isSyncHistoryModalOpen, setIsSyncHistoryModalOpen] = useState(false);
  const [isSyncStagingModalOpen, setIsSyncStagingModalOpen] = useState(false);
  const [isSyncBranchesModalOpen, setIsSyncBranchesModalOpen] = useState(false);

  const pushFetcher = useFetcher();
  const pullFetcher = useFetcher();
  const rollbackFetcher = useFetcher();
  const checkoutFetcher = useFetcher();
  const syncDataFetcher = useFetcher<SyncDataLoaderData>();

  useEffect(() => {
    if (syncDataFetcher.state === 'idle' && !syncDataFetcher.data) {
      syncDataFetcher.load(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/sync-data`);
    }
  }, [organizationId, projectId, syncDataFetcher, workspaceId]);

  if (syncDataFetcher.state !== 'idle' && !syncDataFetcher.data) {
    return (
      <Button className="flex items-center h-9 gap-4 px-[--padding-md] w-full aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
        <Icon icon="refresh" className="animate-spin" /> Initializing
      </Button>
    );
  }

  if (!session.isLoggedIn() || !syncDataFetcher.data) {
    return null;
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
  } = syncDataFetcher.data;
  const canCreateSnapshot = Object.keys(status.stage).length > 0 || Object.keys(status.unstaged).length > 0;

  const canPush = ahead > 0;
  const canPull = behind > 0;
  const pullToolTipMsg = canPull
    ? `There ${behind === 1 ? 'is' : 'are'} ${behind} snapshot${behind === 1 ? '' : 's'} to pull`
    : 'No changes to pull';
  const pushToolTipMsg = canPush
    ? `There ${ahead === 1 ? 'is' : 'are'} ${ahead} snapshot${ahead === 1 ? '' : 's'} to push`
    : 'No changes to push';
  const snapshotToolTipMsg = canCreateSnapshot ? 'Local changes made' : 'No local changes made';

  const localBranchesActionList: {
    id: string;
    name: string;
    icon: IconName;
    isDisabled?: boolean;
    action: () => void;
  }[] = localBranches.map(branch => ({
    id: `checkout-${branch}`,
    name: branch,
    icon: 'code-branch',
    action: () => {
      checkoutFetcher.submit({
        branch,
      }, {
        method: 'POST',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/checkout`,
      });
    },
  }));

  const syncMenuActionList: {
    id: string;
    name: string;
    icon: IconName;
    isDisabled?: boolean;
    action: () => void;
  }[] = [
      {
        id: 'branches',
        name: 'Branches',
        icon: 'code-fork',
        action: () => setIsSyncBranchesModalOpen(true),
      },
      ...localBranchesActionList,
      {
        id: 'history',
        name: 'History',
        icon: 'clock',
        isDisabled: historyCount === 0,
        action: () => setIsSyncHistoryModalOpen(true),
      },
      {
        id: 'revert',
        name: 'Revert Changes',
        icon: 'undo',
        isDisabled: historyCount === 0 || rollbackFetcher.state !== 'idle',
        action: () => {
          rollbackFetcher.submit({}, {
            method: 'POST',
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/rollback`,
          });
        },
      },
      {
        id: 'create',
        name: 'Create Snapshot',
        icon: 'cube',
        isDisabled: !canCreateSnapshot || rollbackFetcher.state !== 'idle',
        action: () => setIsSyncStagingModalOpen(true),
      },
      {
        id: 'pull',
        name: pullFetcher.state !== 'idle' ? 'Pulling Snapshots...' : `Pull ${behind || ''} Snapshot${behind === 1 ? '' : 's'}`,
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
        name: pushFetcher.state !== 'idle' ? 'Pushing Snapshots...' : `Push ${ahead || ''} Snapshot${ahead === 1 ? '' : 's'}`,
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

  return (
    <Fragment>
      <MenuTrigger>
        <div className="flex items-center h-9 gap-4 px-[--padding-md] w-full aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
          <Button
            aria-label="Insomnia Sync"
            className="flex-1 flex items-center gap-2 truncate"
          >
            <Icon
              icon={isSyncing ? 'refresh' : 'cloud'}
              className={`w-5 ${isSyncing ? 'animate-spin' : ''}`}
            />
            <span>{currentBranch}</span>
          </Button>
          <div className="flex items-center gap-2">
            <TooltipTrigger>
              <Button>
                <Icon icon="cube" className={`transition-colors ${canCreateSnapshot ? '' : 'opacity-50'}`} />
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
              <Button>
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
              <Button>
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
        <Popover className="min-w-max" placement='top end' offset={8}>
          <Menu
            aria-label="Insomnia Sync Menu"
            selectionMode="single"
            disabledKeys={syncMenuActionList.filter(item => item.isDisabled).map(item => item.id)}
            onAction={key => {
              const item = syncMenuActionList.find(item => item.id === key);
              item?.action();
            }}
            items={syncMenuActionList}
            className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
          >
            {item => (
              <Item
                className="aria-disabled:opacity-30 aria-disabled:cursor-not-allowed flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                aria-label={item.name}
              >
                <Icon icon={item.icon} />
                <span>{item.name}</span>
              </Item>
            )}
          </Menu>
        </Popover>
      </MenuTrigger>
      {isGitRepoSettingsModalOpen && (
        <GitRepositorySettingsModal
          onHide={() => setIsGitRepoSettingsModalOpen(false)}
        />
      )}
      {isSyncDeleteModalOpen && (
        <SyncDeleteModal
          vcs={vcs}
          onHide={() => {
            setIsSyncDeleteModalOpen(false);
          }}
        />
      )}
      {isSyncBranchesModalOpen && (
        <SyncBranchesModal
          vcs={vcs}
          branches={localBranches}
          currentBranch={currentBranch}
          remoteBranches={remoteBranches.filter(remoteBranch => !localBranches.includes(remoteBranch))}
          onHide={() => {
            setIsSyncBranchesModalOpen(false);
          }}
        />
      )}
      {isSyncStagingModalOpen && (
        <SyncStagingModal
          vcs={vcs}
          branch={currentBranch}
          status={status}
          syncItems={syncItems}
          onHide={() => setIsSyncStagingModalOpen(false)}
        />
      )}
      {isSyncHistoryModalOpen && (
        <SyncHistoryModal
          vcs={vcs}
          branch={currentBranch}
          history={history}
          onHide={() => setIsSyncHistoryModalOpen(false)}
        />
      )}
    </Fragment>
  );
};
