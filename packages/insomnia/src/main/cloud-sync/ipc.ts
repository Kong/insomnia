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
} from 'insomnia-vcs';

import type { Operation } from '../../common/database';
import { ipcMainHandle, ipcMainOn } from '../ipc/electron';
import {
  cancelPendingSyncConflict,
  invokeGlobalVCS,
  invokeVCSForWorkspace,
  pullRemoteBackendProject,
  type PullRemoteBackendProjectOptions,
  resolvePendingSyncConflict,
} from './vcs';

// Methods scoped to a single workspace's VCS instance — every call must say which workspace.
export interface SyncBridgeMethods {
  archiveProject: (workspaceId: string) => Promise<void>;
  checkout: (workspaceId: string, candidates: StatusCandidate[], branchName: string) => Promise<Operation>;
  compareRemoteBranch: (workspaceId: string) => Promise<Compare>;
  fork: (workspaceId: string, newBranchName: string) => Promise<void>;
  getBranchNames: (workspaceId: string) => Promise<string[]>;
  getCurrentBranchName: (workspaceId: string) => Promise<string>;
  getHistory: (workspaceId: string, count?: number) => Promise<Snapshot[]>;
  getHistoryCount: (workspaceId: string) => Promise<number>;
  getRemoteBranchNames: (workspaceId: string) => Promise<string[]>;
  getVersion: (workspaceId: string) => Promise<string>;
  merge: (
    workspaceId: string,
    candidates: StatusCandidate[],
    otherBranchName: string,
    snapshotMessage?: string,
  ) => Promise<Operation>;
  pull: (
    workspaceId: string,
    options: {
      candidates: StatusCandidate[];
      teamId: string;
      teamProjectId: string;
      projectId: string;
    },
  ) => Promise<Operation>;
  push: (workspaceId: string, options: { teamId: string; teamProjectId: string }) => Promise<void>;
  removeBranch: (workspaceId: string, branchName: string) => Promise<void>;
  removeRemoteBranch: (workspaceId: string, branchName: string) => Promise<void>;
  rollback: (workspaceId: string, snapshotId: string, candidates: StatusCandidate[]) => Promise<Operation>;
  rollbackToLatest: (workspaceId: string, candidates: StatusCandidate[]) => Promise<Operation>;
  stage: (workspaceId: string, stageEntries: StageEntry[]) => Promise<Stage>;
  status: (workspaceId: string, candidates: StatusCandidate[]) => Promise<Status>;
  switchAndCreateBackendProjectIfNotExist: (
    workspaceId: string,
    rootDocumentId: string,
    name: string,
  ) => Promise<void>;
  takeSnapshot: (workspaceId: string, name: string) => Promise<void>;
  unstage: (workspaceId: string, stageEntries: StageEntry[]) => Promise<Stage>;
  getActiveBackendProject: (workspaceId: string) => Promise<BackendProject | null>;
  hasBackendProject: (workspaceId: string) => Promise<boolean>;
}

// Methods that never read a VCS instance's active backend project — no workspaceId needed.
export interface GlobalSyncBridgeMethods {
  localBackendProjects: () => Promise<BackendProject[]>;
  remoteBackendProjects: (options: { teamId: string; teamProjectId: string }) => Promise<BackendProjectWithTeam[]>;
  remoteBackendProjectsOfTeam: (options: { teamId: string }) => Promise<BackendProjectWithTeamsAndTeamProjectId[]>;
  hasBackendProjectForRootDocument: (rootDocumentId: string) => Promise<boolean>;
  removeBackendProjectsForRoot: (rootDocumentId: string) => Promise<void>;
}

export interface SyncBridgeAPI extends SyncBridgeMethods, GlobalSyncBridgeMethods {
  pullRemoteBackendProject: (options: PullRemoteBackendProjectOptions) => Promise<{
    projectId: string;
    workspaceId: string;
  }>;
  resolveConflict: (options: { handlerId: string; conflicts: MergeConflict[] }) => void;
  cancelConflict: (options: { handlerId: string }) => void;
}

export const registerSyncHandlers = () => {
  ipcMainHandle('sync.invoke', (event, workspaceId: string, methodName: string, ...args: unknown[]) => {
    return invokeVCSForWorkspace(event.sender, workspaceId, methodName, ...args);
  });

  ipcMainHandle('sync.invokeGlobal', (_event, methodName: string, ...args: unknown[]) => {
    return invokeGlobalVCS(methodName, ...args);
  });

  ipcMainHandle('sync.pullRemoteBackendProject', (event, options: PullRemoteBackendProjectOptions) => {
    return pullRemoteBackendProject(event.sender, options);
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
