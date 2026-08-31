import type { MergeConflict } from 'insomnia-vcs';

import { showModal } from '../components/modals';
import { SyncMergeModal } from '../components/modals/sync-merge-modal';

let hasRegisteredConflictListener = false;

export { UserAbortResolveMergeConflictError } from '~/sync/vcs/utils';

export const registerSyncMergeConflictListener = () => {
  if (hasRegisteredConflictListener) {
    return;
  }

  hasRegisteredConflictListener = true;
  window.main.on('sync.merge-conflicts', (_event, { handlerId, conflicts, labels }) => {
    showModal(SyncMergeModal, {
      conflicts,
      labels,
      onResolveAll: (resolvedConflicts: MergeConflict[]) => {
        window.main.sync.resolveConflict({ handlerId, conflicts: resolvedConflicts });
      },
      onCancelUnresolved: () => {
        window.main.sync.cancelConflict({ handlerId });
      },
    });
  });
};
