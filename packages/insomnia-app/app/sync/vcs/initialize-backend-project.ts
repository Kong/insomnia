import { database } from '../../common/database';
import * as models from '../../models';
import { getStatusCandidates } from '../../models/helpers/get-status-candidates';
import { Project } from '../../models/project';
import { isCollection, Workspace } from '../../models/workspace';
import { WorkspaceMeta } from '../../models/workspace-meta';
import { VCS } from './vcs';

const blankStage = {};

export const initializeLocalBackendProjectAndMarkForSync = async ({ vcs, workspace }: { vcs: VCS; workspace: Workspace }) => {
  if (!isCollection(workspace)) {
    // Don't initialize and mark for sync unless we're in a collection
    return;
  }

  // Create local project
  await vcs.switchAndCreateBackendProjectIfNotExist(workspace._id, workspace.name);

  // Everything unstaged
  const candidates = getStatusCandidates(await database.withDescendants(workspace));
  const status = await vcs.status(candidates, blankStage);

  // Stage everything
  const stage = await vcs.stage(blankStage, Object.values(status.unstaged));

  // Snapshot
  await vcs.takeSnapshot(stage, 'Initial Snapshot');

  // Mark for pushing to the active project
  await models.workspaceMeta.updateByParentId(workspace._id, { pushSnapshotOnInitialize: true });
};

export const pushSnapshotOnInitialize = async ({
  vcs,
  workspace,
  workspaceMeta,
  project: { _id: projectId, remoteId: projectRemoteId },
}: {
  vcs: VCS;
  workspace: Workspace;
  workspaceMeta?: WorkspaceMeta;
  project: Project;
}) => {
  const projectIsForWorkspace = projectId === workspace.parentId;
  const markedForPush = workspaceMeta?.pushSnapshotOnInitialize;

  // A race condition occurs in App.tsx when updating the active workspace
  // One code path is that a React Key updates, forcing all children to unmount and remount (https://github.com/Kong/insomnia/blob/9a943879060927d6ab1c21d3e12daba39ad05eea/packages/insomnia-app/app/ui/containers/app.tsx#L1514-L1514)
  // At the same time, we set VCS to null, then set it to the correct value, in state in App.tsx, forcing downstream updates (https://github.com/Kong/insomnia/blob/9a943879060927d6ab1c21d3e12daba39ad05eea/packages/insomnia-app/app/ui/containers/app.tsx#L1149-L1149)
  // This race condition causes us to hit this codepath twice while activating a workspace but the first time it has no project so we shouldn't do anything
  const hasProject = vcs.hasBackendProject();

  if (markedForPush && projectIsForWorkspace && projectRemoteId && hasProject) {
    await models.workspaceMeta.updateByParentId(workspace._id, { pushSnapshotOnInitialize: false });
    await vcs.push(projectRemoteId);
  }
};
