import type { BaseModel, Project, Workspace } from 'insomnia-data';
import { models, services } from 'insomnia-data';

import { database } from '../../common/database';
import type { Stage, StageEntry, Status, StatusCandidate } from '../types';

export interface SyncVCSLike {
  hasBackendProject: () => boolean | Promise<boolean>;
  push: (options: { teamId: string; teamProjectId: string }) => Promise<void>;
  stage: (stageEntries: StageEntry[]) => Promise<Stage>;
  status: (candidates: StatusCandidate[]) => Promise<Status>;
  switchAndCreateBackendProjectIfNotExist: (rootDocumentId: string, name: string) => Promise<void>;
  takeSnapshot: (name: string) => Promise<void>;
}

export const initializeLocalBackendProjectAndMarkForSync = async ({
  vcs,
  workspace,
}: {
  vcs: SyncVCSLike;
  workspace: Workspace;
}) => {
  // Create local project
  await vcs.switchAndCreateBackendProjectIfNotExist(workspace._id, workspace.name);

  // TEMP DEBUG (race repro, remove after investigation): widen the window between activating
  // this workspace's backend project and staging/committing into it, so that a concurrent
  // switchAndCreateBackendProjectIfNotExist call for a DIFFERENT workspace (e.g. opening/
  // switching to another cloud-synced tab) can land in between and hijack the singleton VCS's
  // active project (docs/cloud-sync.md known defect #4: "单例 VCS 的可变状态").
  const RACE_REPRO_DELAY_MS = 20_000;
  console.log(
    `[RACE-REPRO] initializeLocalBackendProjectAndMarkForSync: workspace=${workspace._id} (${workspace.name}) just activated its backend project. Entering a ${RACE_REPRO_DELAY_MS}ms window — switch to/open ANOTHER cloud-synced workspace tab NOW to trigger the race.`,
  );
  await new Promise(resolve => setTimeout(resolve, RACE_REPRO_DELAY_MS));
  console.log(
    `[RACE-REPRO] initializeLocalBackendProjectAndMarkForSync: workspace=${workspace._id} delay elapsed, resuming status/stage/takeSnapshot.`,
  );

  // The lint ruleset is project-scoped (shared by every design document in the project),
  // so it is not a descendant of the workspace and must be added explicitly.
  const projectLintRuleset = await services.projectLintRuleset.getByParentId(workspace.parentId);

  // Everything unstaged
  const candidates = [
    ...(await database.getWithDescendants(workspace)),
    ...(projectLintRuleset ? [projectLintRuleset] : []),
  ]
    .filter(models.canSync)
    .map(
      (doc: BaseModel): StatusCandidate => ({
        key: doc._id,
        name: doc.name || '',
        document: doc,
      }),
    );
  const status = await vcs.status(candidates);

  // Stage everything
  await vcs.stage(Object.values(status.unstaged));

  // Snapshot
  await vcs.takeSnapshot('Initial Snapshot');

  // Mark for pushing to the active project
  await services.workspaceMeta.updateByParentId(workspace._id, { pushSnapshotOnInitialize: true });
};

export const pushSnapshotOnInitialize = async ({
  vcs,
  workspace,
  project: { _id: projectId, remoteId: projectRemoteId, parentId },
}: {
  vcs: SyncVCSLike;
  workspace: Workspace;
  project: Project;
}) => {
  const projectIsForWorkspace = projectId === workspace.parentId;

  // A race condition occurs in App.tsx when updating the active workspace
  // One code path is that a React Key updates, forcing all children to unmount and remount (https://github.com/Kong/insomnia/blob/9a943879060927d6ab1c21d3e12daba39ad05eea/packages/insomnia-app/app/ui/containers/app.tsx#L1514-L1514)
  // At the same time, we set VCS to null, then set it to the correct value, in state in App.tsx, forcing downstream updates (https://github.com/Kong/insomnia/blob/9a943879060927d6ab1c21d3e12daba39ad05eea/packages/insomnia-app/app/ui/containers/app.tsx#L1149-L1149)
  // This race condition causes us to hit this codepath twice while activating a workspace but the first time it has no project so we shouldn't do anything
  const hasProject = await vcs.hasBackendProject();

  if (projectIsForWorkspace && projectRemoteId && hasProject) {
    await services.workspaceMeta.updateByParentId(workspace._id, { pushSnapshotOnInitialize: false });
    await vcs.push({ teamId: parentId, teamProjectId: projectRemoteId });
  }
};
