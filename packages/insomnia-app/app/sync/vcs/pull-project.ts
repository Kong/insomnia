
import { DEFAULT_BRANCH_NAME } from '../../common/constants';
import { database } from '../../common/database';
import { RemoteProject } from '../../models/project';
import { isWorkspace } from '../../models/workspace';
import { initializeSpaceFromTeam, initializeWorkspaceFromProject } from './initialize-model-from';
import { BackendProjectWithTeam } from './normalize-project-team';
import { interceptAccessError } from './util';
import { VCS } from './vcs';

interface Options {
  vcs: VCS;
  project: BackendProjectWithTeam;
  remoteSpaces: RemoteProject[];
}

export const pullProject = async ({ vcs, project, remoteSpaces }: Options) => {
  // Set project, checkout master, and pull
  await vcs.setBackendProject(project);
  await vcs.checkout([], DEFAULT_BRANCH_NAME);
  const remoteBranches = await interceptAccessError({
    action: 'pull',
    callback: () => vcs.getRemoteBranches(),
    resourceName: project.name,
  });

  const defaultBranchMissing = !remoteBranches.includes(DEFAULT_BRANCH_NAME);

  // Find or create the remote space locally
  let space = remoteSpaces.find(({ remoteId }) => remoteId === project.team.id);
  if (!space) {
    space = await initializeSpaceFromTeam(project.team);
    await database.upsert(space);
  }

  // The default branch does not exist, so we create it and the workspace locally
  if (defaultBranchMissing) {
    const workspace = await initializeWorkspaceFromProject(project, space);
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
