import { FC, useEffect, useRef, useState } from 'react';
import React from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { isLoggedIn } from '../../../account/session';
import { generateId } from '../../../common/misc';
import { isRemoteProject } from '../../../models/project';
import FileSystemDriver from '../../../sync/store/drivers/file-system-driver';
import { MergeConflict } from '../../../sync/types';
import { getVCS, initVCS, VCS } from '../../../sync/vcs/vcs';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { showModal } from '../modals';
import { SyncMergeModal } from '../modals/sync-merge-modal';
import { GitSyncDropdown } from './git-sync-dropdown';
import { SyncDropdown } from './sync-dropdown';

export function useVCS({
  workspaceId,
}: {
  workspaceId?: string;
}) {
  const [vcs, setVCS] = useState<VCS | null>(null);
  const updateVCSLock = useRef<boolean | string>(false);

  // Update VCS when the active workspace changes
  useEffect(() => {
    const lock = generateId();
    updateVCSLock.current = lock;

    // Set vcs to null while we update it
    setVCS(null);

    async function updateVCS() {
      let vcsInstance = getVCS();
      if (!vcsInstance) {
        const driver = FileSystemDriver.create(process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'));

        vcsInstance = await initVCS(driver, async conflicts => {
          return new Promise(resolve => {
            showModal(SyncMergeModal, {
              conflicts,
              handleDone: (conflicts?: MergeConflict[]) => resolve(conflicts || []),
            });
          });
        });
      }

      if (workspaceId) {
        await vcsInstance.switchProject(workspaceId);
      } else {
        await vcsInstance.clearBackendProject();
      }

      // Prevent a potential race-condition when _updateVCS() gets called for different workspaces in rapid succession
      if (updateVCSLock.current === lock) {
        setVCS(vcsInstance);
      }
    }

    updateVCS();
  }, [workspaceId]);

  return vcs;
}

export const WorkspaceSyncDropdown: FC = () => {
  const {
    activeProject,
    activeWorkspace,
    gitRepository,
    activeWorkspaceMeta,
  } = useRouteLoaderData(
    ':workspaceId'
  ) as WorkspaceLoaderData;

  const vcs = useVCS({
    workspaceId: activeWorkspace?._id,
  });

  if (!isLoggedIn()) {
    return null;
  }

  if (isRemoteProject(activeProject) && vcs && !activeWorkspaceMeta?.gitRepositoryId) {
    return (
      <SyncDropdown
        key={activeWorkspace?._id}
        workspace={activeWorkspace}
        project={activeProject}
        vcs={vcs}
      />
    );
  }

  if (activeWorkspaceMeta?.gitRepositoryId || !isRemoteProject(activeProject)) {
    return <GitSyncDropdown isInsomniaSyncEnabled={isRemoteProject(activeProject)} gitRepository={gitRepository} />;
  }

  return null;
};
