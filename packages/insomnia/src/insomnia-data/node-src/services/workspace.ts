import type { BaseModel, Project, Workspace } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

import type { SyncVCSLike } from './vcs';
import {
  getOrCreateByParentId as getMetaOrCreateByParentId,
  updateByParentId as updateMetaByParentId,
} from './workspace-meta';

const { type } = models.workspace;

export function getById(id?: string) {
  return db.findOne<Workspace>(type, { _id: id });
}

export function findByParentId(parentId: string) {
  return db.find<Workspace>(type, { parentId });
}

export async function create(patch: Partial<Workspace> = {}) {
  expectParentToBeProject(patch.parentId);
  return db.docCreate<Workspace>(type, patch);
}

export async function all() {
  return await db.find<Workspace>(type);
}

export function count() {
  return db.count(type);
}

export function update(workspace: Workspace, patch: Partial<Workspace>) {
  expectParentToBeProject(patch.parentId);
  return db.docUpdate(workspace, patch);
}

export function remove(workspace: Workspace) {
  return db.remove(workspace);
}

export function getWorkspacesOfProject(projectId: string) {
  return db.find<Workspace>(type, {
    parentId: projectId,
  });
}

function expectParentToBeProject(parentId?: string | null) {
  if (parentId && !models.project.isProjectId(parentId)) {
    throw new Error('Expected the parent of a Workspace to be a Project');
  }
}

export async function commitAll({
  workspace,
  vcs,
  message,
}: {
  workspace: Workspace;
  vcs: SyncVCSLike;
  message: string;
}) {
  if (!vcs.hasBackendProject()) {
    return;
  }
  // Everything unstaged
  const candidates = (await db.getWithDescendants(workspace)).filter(models.canSync).map((doc: BaseModel) => ({
    key: doc._id,
    name: doc.name || '',
    document: doc,
  }));
  const status = await vcs.status(candidates);

  // Stage everything
  await vcs.stage(Object.values(status.unstaged));

  // Snapshot
  await vcs.takeSnapshot(message);
}

export async function commitAllAndPush({
  workspace,
  vcs,
  message,
  project: { _id: projectId, remoteId: projectRemoteId, parentId: orgId },
}: {
  workspace: Workspace;
  vcs: SyncVCSLike;
  message: string;
  project: Project;
}) {
  if (!vcs.hasBackendProject()) {
    return;
  }

  await commitAll({ workspace, vcs, message });
  // Mark for pushing to the active project
  await updateMetaByParentId(workspace._id, { pushSnapshotOnInitialize: true });
  const hasProject = await vcs.hasBackendProject();
  if (projectId === workspace.parentId && hasProject && projectRemoteId) {
    await updateMetaByParentId(workspace._id, { pushSnapshotOnInitialize: false }); // after below?
    await vcs.push({ teamId: orgId, teamProjectId: projectRemoteId });
  }
}

export async function hasGitRepositoryId(workspace: Workspace) {
  const workspaceMeta = await getMetaOrCreateByParentId(workspace._id);
  return !!workspaceMeta.gitRepositoryId;
}
