
import { DEFAULT_BRANCH_NAME } from '../../common/constants';
import { database } from '../../common/database';
import { RemoteSpace } from '../../models/space';
import { isWorkspace } from '../../models/workspace';
import { initializeSpaceFromTeam } from './initialize-space-from-team';
import { initializeWorkspaceFromProject } from './initialize-workspace-from-project';
import { ProjectWithTeam } from './normalize-project-team';
import { VCS } from './vcs';

interface Options {
  vcs: VCS;
  project: ProjectWithTeam;
  remoteSpaces: RemoteSpace[];
}

export const pullProject = async ({ vcs, project, remoteSpaces }: Options) => {
  // Set project, checkout master, and pull
  await vcs.setProject(project);
  await vcs.checkout([], DEFAULT_BRANCH_NAME);
  const remoteBranches = await vcs.getRemoteBranches();
  const defaultBranchMissing = !remoteBranches.includes(DEFAULT_BRANCH_NAME);

  // Find or create the remote space locally
  let space = remoteSpaces.find(({ remoteId }) => remoteId === project.team.id);
  if (!space) {
    space = await initializeSpaceFromTeam(project.team);
    await database.upsert(space);
  }

  // The default branch does not exist, so we create it and the workspace locally
  if (defaultBranchMissing) {
    const workspace = await initializeWorkspaceFromProject(project);
    await database.upsert(workspace);
  } else {
    await vcs.pull([], space.remoteId); // There won't be any existing docs since it's a new pull

    const flushId = await database.bufferChanges();

    // @ts-expect-error -- TSCONVERSION
    for (const doc of (await vcs.allDocuments() || [])) {
      if (isWorkspace(doc)) {
        doc.parentId = space._id;
      }
      await database.upsert(doc);
    }

    await database.flushChanges(flushId);
  }

  return space;
};
