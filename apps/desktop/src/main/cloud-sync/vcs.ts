import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import { app, type WebContents } from 'electron';
import type { RemoteProject } from 'insomnia-data';
import { services } from 'insomnia-data';

import { invariant } from '~/common/utils/invariant';
import type { VCS } from '~/main/cloud-sync/core/vcs';
import { createVCS } from '~/main/cloud-sync/create-vcs';
import { pullBackendProject } from '~/main/cloud-sync/pull-backend-project';
import type { BackendProjectWithTeam, MergeConflict } from '~/sync/types';
import { UserAbortResolveMergeConflictError } from '~/sync/vcs/errors';

interface SyncInvocationContext {
  sender: WebContents;
}

interface PendingConflictResolution {
  senderId: number;
  resolve: (conflicts: MergeConflict[]) => void;
  reject: (error: Error) => void;
}

export interface PullRemoteBackendProjectOptions {
  organizationId: string;
  backendProjectId: string;
  remoteId: string;
}

const syncInvocationContext = new AsyncLocalStorage<SyncInvocationContext>();
const pendingConflictResolutions = new Map<string, PendingConflictResolution>();

let mainVCS: VCS | null = null;

const requestConflictResolution = (conflicts: MergeConflict[], labels: { ours: string; theirs: string }) => {
  const context = syncInvocationContext.getStore();
  invariant(context, 'Sync conflict resolution requires a renderer context');

  const handlerId = randomUUID();
  context.sender.send('sync.merge-conflicts', {
    handlerId,
    conflicts,
    labels,
  });

  return new Promise<MergeConflict[]>((resolve, reject) => {
    pendingConflictResolutions.set(handlerId, {
      senderId: context.sender.id,
      resolve,
      reject,
    });
  });
};

export const getMainVCS = () => {
  if (mainVCS) {
    return mainVCS;
  }

  mainVCS = createVCS({
    dataPath: process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData'),
    conflictHandler: requestConflictResolution,
  });

  return mainVCS;
};

export const runWithSyncRenderer = <T>(sender: WebContents, callback: () => Promise<T> | T) => {
  return syncInvocationContext.run({ sender }, callback);
};

export const invokeMainVCS = async (sender: WebContents, methodName: string, ...args: unknown[]) => {
  const vcs = getMainVCS();
  const method = vcs[methodName as keyof VCS];

  if (typeof method !== 'function') {
    throw new TypeError(`Unknown VCS method: ${methodName}`);
  }

  return runWithSyncRenderer(sender, () => (method as (...args: unknown[]) => unknown).apply(vcs, args));
};

export const resolvePendingSyncConflict = ({
  handlerId,
  sender,
  conflicts,
}: {
  handlerId: string;
  sender: WebContents;
  conflicts: MergeConflict[];
}) => {
  const pendingConflictResolution = pendingConflictResolutions.get(handlerId);
  invariant(pendingConflictResolution, `Unknown sync conflict request: ${handlerId}`);
  invariant(
    pendingConflictResolution.senderId === sender.id,
    `Sync conflict request ${handlerId} was resolved by an unexpected renderer`,
  );

  pendingConflictResolutions.delete(handlerId);
  pendingConflictResolution.resolve(conflicts);
};

export const cancelPendingSyncConflict = ({ handlerId, sender }: { handlerId: string; sender: WebContents }) => {
  const pendingConflictResolution = pendingConflictResolutions.get(handlerId);
  invariant(pendingConflictResolution, `Unknown sync conflict request: ${handlerId}`);
  invariant(
    pendingConflictResolution.senderId === sender.id,
    `Sync conflict request ${handlerId} was cancelled by an unexpected renderer`,
  );

  pendingConflictResolutions.delete(handlerId);
  pendingConflictResolution.reject(new UserAbortResolveMergeConflictError());
};

export const pullRemoteBackendProjectWithSingleton = async (
  sender: WebContents,
  { organizationId, backendProjectId, remoteId }: PullRemoteBackendProjectOptions,
) => {
  return runWithSyncRenderer(sender, async () => {
    // Use the singleton only for the remote listing (read-only network call).
    // The actual pull uses an isolated VCS instance so the singleton's active
    // backend project is never mutated, preventing cross-workspace interference
    // with concurrent sync.invoke calls.
    const vcs = getMainVCS();
    const remoteBackendProjects = await vcs.remoteBackendProjects({
      teamId: organizationId,
      teamProjectId: remoteId,
    });
    const backendProject = remoteBackendProjects.find(project => project.id === backendProjectId) as
      | BackendProjectWithTeam
      | undefined;

    invariant(backendProject, 'Backend project not found');

    const project = await services.project.getByRemoteId(remoteId);
    invariant(project?.remoteId, 'Project is not a remote project');

    const pullVCS = createVCS({
      dataPath: process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData'),
      conflictHandler: requestConflictResolution,
    });

    await pullVCS.removeBackendProjectsForRoot(backendProject.rootDocumentId);
    const { workspaceId } = await pullBackendProject({
      vcs: pullVCS,
      backendProject,
      remoteProject: project as RemoteProject,
    });
    invariant(typeof workspaceId === 'string', 'Workspace not found after pulling backend project');

    return {
      projectId: project._id,
      workspaceId,
    };
  });
};
