import type {
  BackendProject,
  BackendProjectWithTeam,
  BackendProjectWithTeamsAndTeamProjectId,
  Compare,
  MergeConflict,
  Snapshot,
  Stage,
  StageEntry,
  Status,
  StatusCandidate,
} from '~/sync/types';

import type { Operation } from '../../common/database';
import { ipcMainHandle, ipcMainOn } from '../ipc/electron';
import {
  cancelPendingSyncConflict,
  invokeMainVCS,
  type PullRemoteBackendProjectOptions,
  pullRemoteBackendProjectWithSingleton,
  resolvePendingSyncConflict,
} from './vcs';

export interface SyncBridgeMethods {
  archiveProject: () => Promise<void>;
  checkout: (candidates: StatusCandidate[], branchName: string) => Promise<Operation>;
  compareRemoteBranch: () => Promise<Compare>;
  fork: (newBranchName: string) => Promise<void>;
  getBranchNames: () => Promise<string[]>;
  getCurrentBranchName: () => Promise<string>;
  getHistory: (count?: number) => Promise<Snapshot[]>;
  getHistoryCount: () => Promise<number>;
  getRemoteBranchNames: () => Promise<string[]>;
  getVersion: () => Promise<string>;
  localBackendProjects: () => Promise<BackendProject[]>;
  merge: (candidates: StatusCandidate[], otherBranchName: string, snapshotMessage?: string) => Promise<Operation>;
  pull: (options: {
    candidates: StatusCandidate[];
    teamId: string;
    teamProjectId: string;
    projectId: string;
  }) => Promise<Operation>;
  push: (options: { teamId: string; teamProjectId: string }) => Promise<void>;
  remoteBackendProjects: (options: { teamId: string; teamProjectId: string }) => Promise<BackendProjectWithTeam[]>;
  remoteBackendProjectsOfTeam: (options: { teamId: string }) => Promise<BackendProjectWithTeamsAndTeamProjectId[]>;
  removeBackendProjectsForRoot: (rootDocumentId: string) => Promise<void>;
  removeBranch: (branchName: string) => Promise<void>;
  removeRemoteBranch: (branchName: string) => Promise<void>;
  rollback: (snapshotId: string, candidates: StatusCandidate[]) => Promise<Operation>;
  rollbackToLatest: (candidates: StatusCandidate[]) => Promise<Operation>;
  stage: (stageEntries: StageEntry[]) => Promise<Stage>;
  status: (candidates: StatusCandidate[]) => Promise<Status>;
  switchAndCreateBackendProjectIfNotExist: (rootDocumentId: string, name: string) => Promise<void>;
  takeSnapshot: (name: string) => Promise<void>;
  unstage: (stageEntries: StageEntry[]) => Promise<Stage>;
}

export interface SyncBridgeAPI extends SyncBridgeMethods {
  getActiveBackendProject: () => Promise<BackendProject | null>;
  hasBackendProject: () => Promise<boolean>;
  pullRemoteBackendProject: (options: PullRemoteBackendProjectOptions) => Promise<{
    projectId: string;
    workspaceId: string;
  }>;
  resolveConflict: (options: { handlerId: string; conflicts: MergeConflict[] }) => void;
  cancelConflict: (options: { handlerId: string }) => void;
}

export const registerSyncHandlers = () => {
  ipcMainHandle('sync.invoke', (event, methodName: string, ...args: unknown[]) => {
    return invokeMainVCS(event.sender, methodName, ...args);
  });

  ipcMainHandle('sync.pullRemoteBackendProject', (event, options: PullRemoteBackendProjectOptions) => {
    return pullRemoteBackendProjectWithSingleton(event.sender, options);
  });

  ipcMainOn('sync.resolveConflict', (event, options: { handlerId: string; conflicts: MergeConflict[] }) => {
    resolvePendingSyncConflict({
      handlerId: options.handlerId,
      sender: event.sender,
      conflicts: options.conflicts,
    });
  });

  ipcMainOn('sync.cancelConflict', (event, options: { handlerId: string }) => {
    cancelPendingSyncConflict({
      handlerId: options.handlerId,
      sender: event.sender,
    });
  });
};
