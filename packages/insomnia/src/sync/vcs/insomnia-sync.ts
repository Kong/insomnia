import { showModal } from '../../ui/components/modals';
import { SyncMergeModal } from '../../ui/components/modals/sync-merge-modal';
import FileSystemDriver from '../store/drivers/file-system-driver';
import type { MergeConflict } from '../types';
import { VCS } from './vcs';

let vcs: VCS | null = null;

export class UserAbortResolveMergeConflictError extends Error {
  constructor(msg = 'User aborted merge') {
    super(msg);
  }
  name = 'UserAbortResolveMergeConflictError';
}

export const VCSInstance = () => {
  if (vcs) {
    return vcs;
  }
  const driver = FileSystemDriver.create(process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'));
  vcs = new VCS(driver, async (conflicts, labels) => {
    return new Promise((resolve, reject) => {
      showModal(SyncMergeModal, {
        conflicts,
        labels,
        onResolveAll: (conflicts: MergeConflict[]) => {
          resolve(conflicts);
        },
        onCancelUnresolved: () => {
          reject(new UserAbortResolveMergeConflictError());
        },
      });
    });
  });

  return vcs;
};
