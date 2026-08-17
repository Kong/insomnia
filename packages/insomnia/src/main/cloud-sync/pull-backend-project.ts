import type { BaseModel, RemoteProject } from 'insomnia-data';
import { database, models, services } from 'insomnia-data';

import { invariant } from '~/common/utils/invariant';
import type { VCS } from '~/main/cloud-sync/core/vcs';
import { reconcileBackendProjectRootDocumentId } from '~/main/cloud-sync/root-document-id';
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
    const workspace = await services.workspace.upsert({
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

  const documents = (((await vcs.allDocuments()) as unknown as (BaseModel | null)[] | null) || []).filter(
    (doc): doc is BaseModel => doc !== null,
  );
  const workspaces = documents.filter(models.workspace.isWorkspace);

  // Validate before touching the database. A snapshot that does not describe exactly one workspace
  // cannot produce a collection, and writing its other documents first would leave them orphaned.
  invariant(
    workspaces.length === 1,
    `Backend project ${backendProject.id} has ${workspaces.length} workspaces in its latest snapshot, expected exactly 1`,
  );

  // The workspace identity comes from the snapshot, not from backendProject.rootDocumentId. When
  // the two disagree the local pointer is repaired so this collection stays attached to its history.
  const workspaceId = workspaces[0]._id;
  await reconcileBackendProjectRootDocumentId({ vcs, backendProject, workspaceId });

  const flushId = await database.bufferChanges();
  for (const doc of documents) {
    // When we pull a BackendProject we need to update the parent ID of the workspace so that it appears inside.
    // There can't be more than one workspace.
    if (models.workspace.isWorkspace(doc)) {
      doc.parentId = remoteProject._id;
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
