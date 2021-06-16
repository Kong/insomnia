import { database } from '../../common/database';
import * as models from '../../models';
import { getStatusCandidates } from '../../models/helpers/get-status-candidates';
import { Space } from '../../models/space';
import { Workspace } from '../../models/workspace';
import { WorkspaceMeta } from '../../models/workspace-meta';
import { VCS } from './vcs';

const blankStage = {};

export const initializeLocalProjectAndMarkForSync = async ({ vcs, workspace }: { vcs: VCS; workspace: Workspace; }) => {
  // Create local project
  await vcs.switchAndCreateProjectIfNotExist(workspace._id, workspace.name);

  // Everything unstaged
  const candidates = getStatusCandidates(await database.withDescendants(workspace));
  const status = await vcs.status(candidates, blankStage);

  // Stage everything
  const stage = await vcs.stage(blankStage, Object.values(status.unstaged));

  // Snapshot
  await vcs.takeSnapshot(stage, 'Initial Snapshot');

  // Mark for pushing to the active space
  await models.workspaceMeta.updateByParentId(workspace._id, { pushSnapshotOnInitialize: true });
};

export const pushSnapshotOnInitialize = async ({
  vcs,
  workspace,
  workspaceMeta,
  space: { _id: spaceId, remoteId: spaceRemoteId },
}: {
  vcs: VCS;
  workspace: Workspace;
  workspaceMeta?: WorkspaceMeta;
  space: Space;
}) => {
  const spaceIsForWorkspace = spaceId === workspace.parentId;
  const markedForPush = workspaceMeta?.pushSnapshotOnInitialize;

  if (markedForPush && spaceIsForWorkspace && spaceRemoteId) {
    await models.workspaceMeta.updateByParentId(workspace._id, { pushSnapshotOnInitialize: false });
    await vcs.push(spaceRemoteId);
  }
};
