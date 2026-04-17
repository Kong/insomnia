import { showModal } from '../../ui/components/modals';
import { SyncMergeModal } from '../../ui/components/modals/sync-merge-modal';
import type { BackendProject, MergeConflict } from '../types';
import type { VCS } from './vcs';

let vcs: VCS | null = null;
let activeBackendProject: BackendProject | null = null;
let hasRegisteredConflictListener = false;

const refreshActiveBackendProject = async () => {
  activeBackendProject = await window.main.sync.invoke<BackendProject | null>('getActiveBackendProject');
};

const registerConflictListener = () => {
  if (hasRegisteredConflictListener) {
    return;
  }

  hasRegisteredConflictListener = true;
  window.main.sync.on('sync.merge-conflicts', (_event, { requestId, conflicts, labels }) => {
    showModal(SyncMergeModal, {
      conflicts,
      labels,
      onResolveAll: (conflicts: MergeConflict[]) => {
        window.main.sync.resolveConflict({ requestId, conflicts });
      },
      onCancelUnresolved: () => {
        window.main.sync.cancelConflict({ requestId });
      },
    });
  });
};

const createRendererVCSProxy = () =>
  new Proxy({} as VCS, {
    get(_target, property) {
      if (typeof property !== 'string') {
        return;
      }

      if (property === 'getActiveBackendProject') {
        return () => activeBackendProject;
      }

      if (property === 'hasBackendProject') {
        return () => activeBackendProject !== null;
      }

      if (property === 'newInstance') {
        return () => {
          throw new Error('VCS.newInstance() is not available in renderer. Use main-process sync helpers instead.');
        };
      }

      return async (...args: unknown[]) => {
        try {
          const result = await window.main.sync.invoke(property, ...args);

          if (property === 'setBackendProject') {
            activeBackendProject = (args[0] as BackendProject | undefined) || null;
          } else if (
            property === 'archiveProject' ||
            property === 'clearBackendProject' ||
            property === 'switchProject' ||
            property === 'switchAndCreateBackendProjectIfNotExist'
          ) {
            await refreshActiveBackendProject();
          }

          return result;
        } catch (error) {
          if (
            typeof error === 'object' &&
            error !== null &&
            'name' in error &&
            error.name === 'UserAbortResolveMergeConflictError'
          ) {
            const message = 'message' in error && typeof error.message === 'string' ? error.message : undefined;
            throw new UserAbortResolveMergeConflictError(message);
          }

          throw error;
        }
      };
    },
  });

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
  registerConflictListener();
  void refreshActiveBackendProject();
  vcs = createRendererVCSProxy();

  return vcs;
};
