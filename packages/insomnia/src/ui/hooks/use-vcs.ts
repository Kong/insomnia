import  { useEffect, useRef, useState } from 'react';

import { getDataDirectory } from '../../common/electron-helpers';
import { generateId } from '../../common/misc';
import FileSystemDriver from '../../sync/store/drivers/file-system-driver';
import { type MergeConflict } from '../../sync/types';
import { VCS } from '../../sync/vcs/vcs';
import { showModal } from '../components/modals/index';
import { SyncMergeModal } from '../components/modals/sync-merge-modal';

let vcsInstance: VCS | null = null;

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
      if (!vcsInstance) {
        const driver = FileSystemDriver.create(getDataDirectory());

        vcsInstance = new VCS(driver, async conflicts => {
          return new Promise(resolve => {
            showModal(SyncMergeModal, {
              conflicts,
              handleDone: (conflicts: MergeConflict[]) => resolve(conflicts),
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
