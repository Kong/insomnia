
import { DEFAULT_BRANCH_NAME } from '../../common/constants';
import { isWorkspace } from '../../models/helpers/is-model';
import { Workspace } from '../../models/workspace';
import { Project } from '../types';
import * as models from '../../models';
import { database } from '../../common/database';
import { VCS } from './vcs';

interface Options {
  vcs: VCS;
  project: Project;
  spaceId?: string;
}

export const pullProject = async ({ vcs, project, spaceId }: Options) => {
  // Set project, checkout master, and pull
  await vcs.setProject(project);
  await vcs.checkout([], DEFAULT_BRANCH_NAME);
  const remoteBranches = await vcs.getRemoteBranches();
  const defaultBranchMissing = !remoteBranches.includes(DEFAULT_BRANCH_NAME);

  const workspaceParentId = spaceId || null;

  // The default branch does not exist, so we create it and the workspace locally
  if (defaultBranchMissing) {
    const workspace: Workspace = await models.initModel(models.workspace.type, {
      _id: project.rootDocumentId,
      name: project.name,
      parentId: workspaceParentId,
    });
    await database.upsert(workspace);
  } else {
    await vcs.pull([]); // There won't be any existing docs since it's a new pull

    const flushId = await database.bufferChanges();

    // @ts-expect-error -- TSCONVERSION
    for (const doc of (await vcs.allDocuments() || [])) {
      if (isWorkspace(doc)) {
        // @ts-expect-error parent id is optional for workspaces
        doc.parentId = workspaceParentId;
      }
      await database.upsert(doc);
    }

    await database.flushChanges(flushId);
  }
};
