import { DEFAULT_BRANCH_NAME } from '../../common/constants';
import { database } from '../../common/database';
import * as models from '../../models';
import { RemoteProject } from '../../models/project';
import { isWorkspace, Workspace } from '../../models/workspace';
import { invariant } from '../../utils/invariant';
import { BackendProjectWithTeam } from './normalize-backend-project-team';
import { interceptAccessError } from './util';
import { VCS } from './vcs';

interface Options {
  vcs: VCS;
  backendProject: BackendProjectWithTeam;
  remoteProject: RemoteProject;
}

export const pullBackendProject = async ({ vcs, backendProject, remoteProject }: Options) => {
  // checkout master, and pull
  await vcs.checkout([], DEFAULT_BRANCH_NAME);
  const remoteBranches = await interceptAccessError({
    action: 'pull',
    callback: () => vcs.getRemoteBranches(),
    resourceName: backendProject.name,
  });

  const defaultBranchMissing = !remoteBranches.includes(DEFAULT_BRANCH_NAME);

  let workspaceId;

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

    workspaceId = workspace._id;
  } else {
    await vcs.pull({ candidates: [], teamId: remoteProject.parentId, teamProjectId: remoteProject._id }); // There won't be any existing docs since it's a new pull

    const flushId = await database.bufferChanges();

    const branch = await vcs._getCurrentBranch();
    const snapshot = await vcs._getLatestSnapshot(branch.name);
    invariant(snapshot, 'Failed to get latest commit for all documents');

    const allDocuments = await vcs._getBlobs(snapshot.state.map(s => s.blob));

    for (const doc of (allDocuments || [])) {
      if (!doc) {
        continue;
      }
      if (isWorkspace(doc)) {
        doc.parentId = remoteProject._id;
        workspaceId = doc._id;
      }
      await database.upsert(doc);
    }

    await database.flushChanges(flushId);
  }

  return { project: remoteProject, workspaceId };
};
