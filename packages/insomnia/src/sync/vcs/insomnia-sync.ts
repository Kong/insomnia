import type { MergeConflict } from '~/insomnia-data';

import { showModal } from '../../ui/components/modals';
import { SyncMergeModal } from '../../ui/components/modals/sync-merge-modal';

let hasRegisteredConflictListener = false;

export { UserAbortResolveMergeConflictError } from './errors';

export const registerSyncMergeConflictListener = () => {
  if (hasRegisteredConflictListener) {
    return;
  }

  hasRegisteredConflictListener = true;
  window.main.sync.on('sync.merge-conflicts', (_event, { handlerId, conflicts, labels }) => {
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
