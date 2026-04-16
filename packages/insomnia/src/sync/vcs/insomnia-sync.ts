import { showModal } from '../../ui/components/modals';
import { SyncMergeModal } from '../../ui/components/modals/sync-merge-modal';
import type { MergeConflict } from '../types';
import { createVCS } from './create-vcs';
import type { VCS } from './vcs';

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
  vcs = createVCS({
    dataPath: process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'),
    conflictHandler: async (conflicts, labels) => {
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
    },
  });

  return vcs;
};
