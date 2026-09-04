import {
  hasBackendProjectForRootDocument,
  localBackendProjects,
  type MergeConflict,
  remoteBackendProjects,
  remoteBackendProjectsOfTeam,
  removeBackendProjectsForRoot,
  type VCS,
} from 'insomnia-vcs';

import { BaseIpcHandler } from '~/main/ipc/base-ipc-handler';

import {
  cancelPendingSyncConflict,
  invokeVCSForWorkspace,
  pullRemoteBackendProject,
  type PullRemoteBackendProjectOptions,
  resolvePendingSyncConflict,
} from './vcs';

export class SyncIpcHandler extends BaseIpcHandler {
  channel = 'sync';

  async pullRemoteBackendProject(sender: Electron.WebContents, options: PullRemoteBackendProjectOptions) {
    return await pullRemoteBackendProject(sender, options);
  }

  resolveConflict(sender: Electron.WebContents, options: { handlerId: string; conflicts: MergeConflict[] }) {
    resolvePendingSyncConflict({
      handlerId: options.handlerId,
      sender,
      conflicts: options.conflicts,
    });
  }

  cancelConflict(sender: Electron.WebContents, options: { handlerId: string }) {
    cancelPendingSyncConflict({
      handlerId: options.handlerId,
      sender,
    });
  }

  async archiveProject(sender: Electron.WebContents, workspaceId: string, ...args: Parameters<VCS['archiveProject']>) {
    return await invokeVCSForWorkspace(sender, 'archiveProject', workspaceId, ...args);
  }

  async checkout(sender: Electron.WebContents, workspaceId: string, ...args: Parameters<VCS['checkout']>) {
    return await invokeVCSForWorkspace(sender, 'checkout', workspaceId, ...args);
  }

  async compareRemoteBranch(
    sender: Electron.WebContents,
    workspaceId: string,
    ...args: Parameters<VCS['compareRemoteBranch']>
  ) {
    return await invokeVCSForWorkspace(sender, 'compareRemoteBranch', workspaceId, ...args);
  }

  async fork(sender: Electron.WebContents, workspaceId: string, ...args: Parameters<VCS['fork']>) {
    return await invokeVCSForWorkspace(sender, 'fork', workspaceId, ...args);
  }

  async getBranchNames(sender: Electron.WebContents, workspaceId: string, ...args: Parameters<VCS['getBranchNames']>) {
    return await invokeVCSForWorkspace(sender, 'getBranchNames', workspaceId, ...args);
  }

  async getCurrentBranchName(
    sender: Electron.WebContents,
    workspaceId: string,
    ...args: Parameters<VCS['getCurrentBranchName']>
  ) {
    return await invokeVCSForWorkspace(sender, 'getCurrentBranchName', workspaceId, ...args);
  }

  async getHistory(sender: Electron.WebContents, workspaceId: string, ...args: Parameters<VCS['getHistory']>) {
    return await invokeVCSForWorkspace(sender, 'getHistory', workspaceId, ...args);
  }

  async getHistoryCount(
    sender: Electron.WebContents,
    workspaceId: string,
    ...args: Parameters<VCS['getHistoryCount']>
  ) {
    return await invokeVCSForWorkspace(sender, 'getHistoryCount', workspaceId, ...args);
  }

  async getRemoteBranchNames(
    sender: Electron.WebContents,
    workspaceId: string,
    ...args: Parameters<VCS['getRemoteBranchNames']>
  ) {
    return await invokeVCSForWorkspace(sender, 'getRemoteBranchNames', workspaceId, ...args);
  }

  async getVersion(sender: Electron.WebContents, workspaceId: string, ...args: Parameters<VCS['getVersion']>) {
    return await invokeVCSForWorkspace(sender, 'getVersion', workspaceId, ...args);
  }

  async hasBackendProject(
    sender: Electron.WebContents,
    workspaceId: string,
    ...args: Parameters<VCS['hasBackendProject']>
  ) {
    return await invokeVCSForWorkspace(sender, 'hasBackendProject', workspaceId, ...args);
  }

  async getActiveBackendProject(
    sender: Electron.WebContents,
    workspaceId: string,
    ...args: Parameters<VCS['getActiveBackendProject']>
  ) {
    return await invokeVCSForWorkspace(sender, 'getActiveBackendProject', workspaceId, ...args);
  }

  async merge(sender: Electron.WebContents, workspaceId: string, ...args: Parameters<VCS['merge']>) {
    return await invokeVCSForWorkspace(sender, 'merge', workspaceId, ...args);
  }

  async pull(sender: Electron.WebContents, workspaceId: string, ...args: Parameters<VCS['pull']>) {
    return await invokeVCSForWorkspace(sender, 'pull', workspaceId, ...args);
  }

  async push(sender: Electron.WebContents, workspaceId: string, ...args: Parameters<VCS['push']>) {
    return await invokeVCSForWorkspace(sender, 'push', workspaceId, ...args);
  }

  async remoteBackendProjectsOfTeam(_: Electron.WebContents, ...args: Parameters<typeof remoteBackendProjectsOfTeam>) {
    return await remoteBackendProjectsOfTeam(...args);
  }

  async remoteBackendProjects(_: Electron.WebContents, ...args: Parameters<typeof remoteBackendProjects>) {
    return await remoteBackendProjects(...args);
  }

  async localBackendProjects(_: Electron.WebContents, ...args: Parameters<typeof localBackendProjects>) {
    return await localBackendProjects(...args);
  }

  async removeBackendProjectsForRoot(
    _: Electron.WebContents,
    ...args: Parameters<typeof removeBackendProjectsForRoot>
  ) {
    return await removeBackendProjectsForRoot(...args);
  }

  async hasBackendProjectForRootDocument(
    _: Electron.WebContents,
    ...args: Parameters<typeof hasBackendProjectForRootDocument>
  ) {
    return await hasBackendProjectForRootDocument(...args);
  }

  async removeBranch(sender: Electron.WebContents, workspaceId: string, ...args: Parameters<VCS['removeBranch']>) {
    return await invokeVCSForWorkspace(sender, 'removeBranch', workspaceId, ...args);
  }

  async removeRemoteBranch(
    sender: Electron.WebContents,
    workspaceId: string,
    ...args: Parameters<VCS['removeRemoteBranch']>
  ) {
    return await invokeVCSForWorkspace(sender, 'removeRemoteBranch', workspaceId, ...args);
  }

  async rollback(sender: Electron.WebContents, workspaceId: string, ...args: Parameters<VCS['rollback']>) {
    return await invokeVCSForWorkspace(sender, 'rollback', workspaceId, ...args);
  }

  async rollbackToLatest(
    sender: Electron.WebContents,
    workspaceId: string,
    ...args: Parameters<VCS['rollbackToLatest']>
  ) {
    return await invokeVCSForWorkspace(sender, 'rollbackToLatest', workspaceId, ...args);
  }

  async stage(sender: Electron.WebContents, workspaceId: string, ...args: Parameters<VCS['stage']>) {
    return await invokeVCSForWorkspace(sender, 'stage', workspaceId, ...args);
  }

  async status(sender: Electron.WebContents, workspaceId: string, ...args: Parameters<VCS['status']>) {
    return await invokeVCSForWorkspace(sender, 'status', workspaceId, ...args);
  }

  async switchAndCreateBackendProjectIfNotExist(
    sender: Electron.WebContents,
    workspaceId: string,
    ...args: Parameters<VCS['switchAndCreateBackendProjectIfNotExist']>
  ) {
    return await invokeVCSForWorkspace(sender, 'switchAndCreateBackendProjectIfNotExist', workspaceId, ...args);
  }

  async takeSnapshot(sender: Electron.WebContents, workspaceId: string, ...args: Parameters<VCS['takeSnapshot']>) {
    return await invokeVCSForWorkspace(sender, 'takeSnapshot', workspaceId, ...args);
  }

  async unstage(sender: Electron.WebContents, workspaceId: string, ...args: Parameters<VCS['unstage']>) {
    return await invokeVCSForWorkspace(sender, 'unstage', workspaceId, ...args);
  }
}
