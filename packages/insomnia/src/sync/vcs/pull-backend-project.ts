import { DEFAULT_BRANCH_NAME } from '../../common/constants';
import { database } from '../../common/database';
import * as models from '../../models';
import type { RemoteProject } from '../../models/project';
import { isWorkspace, type Workspace } from '../../models/workspace';
import type { BackendProjectWithTeam } from './normalize-backend-project-team';
import { interceptAccessError } from './util';
import { VCS } from './vcs';

interface Options {
  vcs: VCS;
  backendProject: BackendProjectWithTeam;
  remoteProject: RemoteProject;
}

export const pullBackendProject = async ({ vcs, backendProject, remoteProject }: Options) => {
  // Set backend project, checkout master, and pull
  await vcs.setBackendProject(backendProject);
  await vcs.checkout([], DEFAULT_BRANCH_NAME);
  const remoteBranches = await interceptAccessError({
    action: 'pull',
    callback: () => vcs.getRemoteBranchNames(),
    resourceName: backendProject.name,
  });

  const defaultBranchMissing = !remoteBranches.includes(DEFAULT_BRANCH_NAME);

  // @TODO Revisit the UX for this. What should happen if there are other branches?
  // The default branch does not exist, so we create it and the workspace locally
  if (defaultBranchMissing) {
    const workspace = await models.initModel<Workspace>(
      models.workspace.type,
      {
        _id: backendProject.rootDocumentId,
        name: backendProject.name,
        parentId: remoteProject._id,
        scope: 'collection',
      },
    );

    await database.upsert(workspace);

    return { project: remoteProject, workspaceId: workspace._id };
  }

  await vcs.pull({ candidates: [], teamId: remoteProject.parentId, teamProjectId: remoteProject._id, projectId: remoteProject._id }); // There won't be any existing docs since it's a new pull

  const flushId = await database.bufferChanges();
  let workspaceId;
  // @ts-expect-error -- TSCONVERSION
  for (const doc of (await vcs.allDocuments()) || []) {
    // When we pull a BackendProject we need to update the parent ID of the workspace so that it appears inside.
    // There can't be more than one workspace.
    if (isWorkspace(doc)) {
      doc.parentId = remoteProject._id;
      workspaceId = doc._id;
    }
    await database.upsert(doc);
  }

  await database.flushChanges(flushId);
  return { project: remoteProject, workspaceId };

};
