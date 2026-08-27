import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import { app, type WebContents } from 'electron';
import type { RemoteProject } from 'insomnia-data';
import { services } from 'insomnia-data';
import type { BackendProjectWithTeam, MergeConflict } from 'insomnia-vcs';
import {
  configureStore,
  FileSystemDriver,
  remoteBackendProjects,
  removeBackendProjectsForRoot,
  VCS,
} from 'insomnia-vcs';

import { PLAYWRIGHT_TEST } from '~/common/constants';
import { invariant } from '~/common/utils/invariant';
import { pullBackendProject } from '~/main/cloud-sync/pull-backend-project';
import { UserAbortResolveMergeConflictError } from '~/sync/vcs/utils';

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

// One VCS instance per workspace, so a `_backendProject` mutation triggered by one workspace's
// sync.invoke call can never bleed into another workspace's concurrently in-flight operation.
const vcsByWorkspaceId = new Map<string, VCS>();

let storeConfigured = false;
const ensureStoreConfigured = () => {
  if (!storeConfigured) {
    const dataPath = process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData');
    configureStore(FileSystemDriver.create(dataPath));
    storeConfigured = true;
  }
};

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

export const getVCSForWorkspace = (workspaceId: string): VCS => {
  ensureStoreConfigured();
  let vcs = vcsByWorkspaceId.get(workspaceId);

  if (!vcs) {
    vcs = new VCS({
      workspaceId,
      conflictHandler: requestConflictResolution,
      testMode: !!PLAYWRIGHT_TEST,
    });
    vcsByWorkspaceId.set(workspaceId, vcs);
  }

  return vcs;
};

export const runWithSyncRenderer = <T>(sender: WebContents, callback: () => Promise<T> | T) => {
  return syncInvocationContext.run({ sender }, callback);
};

type MethodNames<T> = {
  [K in keyof T]-?: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

export async function invokeVCSForWorkspace<K extends keyof VCS>(
  sender: WebContents,
  methodName: VCS[K] extends (...args: any[]) => any ? K : never,
  workspaceId: string,
  ...args: VCS[K] extends (...args: any[]) => any ? Parameters<VCS[K]> : never
): Promise<VCS[K] extends (...args: any[]) => any ? Awaited<ReturnType<VCS[K]>> : never>;
export async function invokeVCSForWorkspace(
  sender: WebContents,
  methodName: MethodNames<VCS>,
  workspaceId: string,
  ...args: unknown[]
) {
  const vcs = getVCSForWorkspace(workspaceId);
  const method = vcs[methodName];

  if (typeof method !== 'function') {
    throw new TypeError(`Unknown VCS method: ${String(methodName)}`);
  }

  return runWithSyncRenderer(sender, () => (method as (...args: unknown[]) => unknown).apply(vcs, args));
}

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

export const pullRemoteBackendProject = async (
  sender: WebContents,
  { organizationId, backendProjectId, remoteId }: PullRemoteBackendProjectOptions,
) => {
  return runWithSyncRenderer(sender, async () => {
    ensureStoreConfigured();
    const projects = await remoteBackendProjects({
      teamId: organizationId,
      teamProjectId: remoteId,
    });
    const backendProject = projects.find(project => project.id === backendProjectId) as
      | BackendProjectWithTeam
      | undefined;

    invariant(backendProject, 'Backend project not found');

    const project = await services.project.getByRemoteId(remoteId);
    invariant(project?.remoteId, 'Project is not a remote project');

    // backendProject.rootDocumentId is the target workspace's id, so the pull runs on that
    // workspace's own VCS instance directly — no need for a separate isolated instance to shield
    // a singleton's mutable state from other concurrent sync.invoke calls.
    await removeBackendProjectsForRoot(backendProject.rootDocumentId);
    const vcs = getVCSForWorkspace(backendProject.rootDocumentId);
    const { workspaceId } = await pullBackendProject({
      vcs,
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
