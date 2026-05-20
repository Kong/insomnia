import type { RemoteProject, Workspace } from '~/insomnia-data';
import { database, models } from '~/insomnia-data';
import type { VCS } from '~/main/cloud-sync/core/vcs';
import { interceptAccessError } from '~/sync/access-error';
import type { BackendProjectWithTeam } from '~/sync/types';

import { DEFAULT_BRANCH_NAME } from '../../common/constants';

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
    const workspace = await database.update<Workspace>({
      ...models.workspace.init(),
      _id: backendProject.rootDocumentId,
      name: backendProject.name,
      parentId: remoteProject._id,
      scope: 'collection',
      modified: Date.now(),
      created: Date.now(),
      isPrivate: false,
      type: models.workspace.type,
    });

    return { project: remoteProject, workspaceId: workspace._id };
  }

  await vcs.pull({
    candidates: [],
    teamId: remoteProject.parentId,
    teamProjectId: remoteProject._id,
    projectId: remoteProject._id,
  }); // There won't be any existing docs since it's a new pull

  const flushId = await database.bufferChanges();
  let workspaceId;
  // @ts-expect-error -- TSCONVERSION
  for (const doc of (await vcs.allDocuments()) || []) {
    // When we pull a BackendProject we need to update the parent ID of the workspace so that it appears inside.
    // There can't be more than one workspace.
    if (models.workspace.isWorkspace(doc)) {
      doc.parentId = remoteProject._id;
      workspaceId = doc._id;
    }
    // ProjectLintRuleset is parented to the project, whose _id is not stable across machines,
    // so its parentId is normalized to null in sync transit. Re-parent it to the local project.
    if (models.projectLintRuleset.isProjectLintRuleset(doc)) {
      doc.parentId = remoteProject._id;
    }
    const allModelType = models.types();
    if (allModelType.includes(doc.type)) {
      await database.update(doc);
    }
  }

  await database.flushChanges(flushId);
  return { project: remoteProject, workspaceId };
};
