import { database } from '../../common/database';
import * as models from '../../models';
import { BaseModel, canSync } from '../../models';
import { Project } from '../../models/project';
import { Workspace } from '../../models/workspace';
import { StatusCandidate } from '../types';
import { VCS } from './vcs';

const blankStage = {};

export const initializeLocalBackendProjectAndMarkForSync = async ({ vcs, workspace }: { vcs: VCS; workspace: Workspace }) => {
  // Create local project
  await vcs.switchAndCreateBackendProjectIfNotExist(workspace._id, workspace.name);

  // Everything unstaged
  const candidates = (await database.withDescendants(workspace)).filter(canSync).map((doc: BaseModel): StatusCandidate => ({
    key: doc._id,
    name: doc.name || '',
    document: doc,
  }));
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
  project: { _id: projectId, remoteId: projectRemoteId, parentId },
}: {
  vcs: VCS;
  workspace: Workspace;
  project: Project;
}) => {
  const projectIsForWorkspace = projectId === workspace.parentId;

  // A race condition occurs in App.tsx when updating the active workspace
  // One code path is that a React Key updates, forcing all children to unmount and remount (https://github.com/Kong/insomnia/blob/9a943879060927d6ab1c21d3e12daba39ad05eea/packages/insomnia-app/app/ui/containers/app.tsx#L1514-L1514)
  // At the same time, we set VCS to null, then set it to the correct value, in state in App.tsx, forcing downstream updates (https://github.com/Kong/insomnia/blob/9a943879060927d6ab1c21d3e12daba39ad05eea/packages/insomnia-app/app/ui/containers/app.tsx#L1149-L1149)
  // This race condition causes us to hit this codepath twice while activating a workspace but the first time it has no project so we shouldn't do anything
  const hasProject = vcs.hasBackendProject();

  if (projectIsForWorkspace && projectRemoteId && hasProject) {
    await models.workspaceMeta.updateByParentId(workspace._id, { pushSnapshotOnInitialize: false });
    await vcs.push({ teamId: parentId, teamProjectId: projectRemoteId });
  }
};
