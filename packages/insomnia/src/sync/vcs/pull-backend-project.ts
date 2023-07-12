import { DEFAULT_BRANCH_NAME } from '../../common/constants';
import { database } from '../../common/database';
import { RemoteProject } from '../../models/project';
import { isWorkspace } from '../../models/workspace';
import {
  initializeProjectFromTeam,
  initializeWorkspaceFromBackendProject,
} from './initialize-model-from';
import { BackendProjectWithTeam } from './normalize-backend-project-team';
import { interceptAccessError } from './util';
import { VCS } from './vcs';

interface Options {
  vcs: VCS;
  backendProject: BackendProjectWithTeam;
  remoteProjects: RemoteProject[];
  teamProjectId: string;
}

export const pullBackendProject = async ({ vcs, backendProject, remoteProjects, teamProjectId }: Options) => {
  // Set backend project, checkout master, and pull
  await vcs.setBackendProject(backendProject);
  await vcs.checkout([], DEFAULT_BRANCH_NAME);
  const remoteBranches = await interceptAccessError({
    action: 'pull',
    callback: () => vcs.getRemoteBranches(),
    resourceName: backendProject.name,
  });

  const defaultBranchMissing = !remoteBranches.includes(DEFAULT_BRANCH_NAME);

  // Find or create the remote project locally
  let project = remoteProjects.find(({ _id }) => _id === teamProjectId);
  if (!project) {
    project = await initializeProjectFromTeam(backendProject.team);
    await database.upsert(project);
  }

  let workspaceId;

  // The default branch does not exist, so we create it and the workspace locally
  if (defaultBranchMissing) {
    const workspace = await initializeWorkspaceFromBackendProject(
      backendProject,
      project
    );
    await database.upsert(workspace);

    workspaceId = workspace._id;
  } else {
    await vcs.pull({ candidates: [], teamId: project.parentId, teamProjectId: project._id }); // There won't be any existing docs since it's a new pull

    const flushId = await database.bufferChanges();

    // @ts-expect-error -- TSCONVERSION
    for (const doc of (await vcs.allDocuments()) || []) {
      if (isWorkspace(doc)) {
        doc.parentId = project._id;
        workspaceId = doc._id;
      }
      await database.upsert(doc);
    }

    await database.flushChanges(flushId);
  }

  return { project, workspaceId };
};
