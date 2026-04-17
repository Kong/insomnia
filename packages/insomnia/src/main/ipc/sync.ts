import type { IpcRendererEvent } from 'electron';

import type { MergeConflict } from '~/sync/types';
import type { VCS } from '~/sync/vcs/vcs';

import {
  cancelPendingSyncConflict,
  invokeMainVCS,
  type PullRemoteBackendProjectOptions,
  pullRemoteBackendProjectWithSingleton,
  resolvePendingSyncConflict,
} from '../sync-vcs';
import { ipcMainHandle, ipcMainOn } from './electron';

type SyncBridgeMethods = Pick<
  VCS,
  | 'archiveProject'
  | 'checkout'
  | 'compareRemoteBranch'
  | 'fork'
  | 'getBranchNames'
  | 'getCurrentBranchName'
  | 'getHistory'
  | 'getHistoryCount'
  | 'getRemoteBranchNames'
  | 'getVersion'
  | 'localBackendProjects'
  | 'merge'
  | 'pull'
  | 'push'
  | 'remoteBackendProjects'
  | 'removeBackendProjectsForRoot'
  | 'removeBranch'
  | 'removeRemoteBranch'
  | 'rollback'
  | 'rollbackToLatest'
  | 'stage'
  | 'status'
  | 'switchAndCreateBackendProjectIfNotExist'
  | 'takeSnapshot'
  | 'unstage'
>;

export interface SyncBridgeAPI extends SyncBridgeMethods {
  getActiveBackendProject: VCS['getActiveBackendProject'];
  hasBackendProject: VCS['hasBackendProject'];
  pullRemoteBackendProject: (options: PullRemoteBackendProjectOptions) => Promise<{
    projectId: string;
    workspaceId: string;
  }>;
  resolveConflict: (options: { requestId: string; conflicts: MergeConflict[] }) => void;
  cancelConflict: (options: { requestId: string }) => void;
  on: (
    channel: 'sync.merge-conflicts',
    listener: (
      event: IpcRendererEvent,
      options: {
        requestId: string;
        conflicts: MergeConflict[];
        labels: { ours: string; theirs: string };
      },
    ) => void,
  ) => () => void;
}

export const registerSyncHandlers = () => {
  ipcMainHandle('sync.invoke', (event, methodName: string, ...args: unknown[]) => {
    return invokeMainVCS(event.sender, methodName, ...args);
  });

  ipcMainHandle('sync.pullRemoteBackendProject', (event, options: PullRemoteBackendProjectOptions) => {
    return pullRemoteBackendProjectWithSingleton(event.sender, options);
  });

  ipcMainOn('sync.resolveConflict', (event, options: { requestId: string; conflicts: MergeConflict[] }) => {
    resolvePendingSyncConflict({
      requestId: options.requestId,
      sender: event.sender,
      conflicts: options.conflicts,
    });
  });

  ipcMainOn('sync.cancelConflict', (event, options: { requestId: string }) => {
    cancelPendingSyncConflict({
      requestId: options.requestId,
      sender: event.sender,
    });
  });
};
