import { invariant } from '@remix-run/router';
import { ActionFunction, redirect } from 'react-router-dom';

import * as session from '../../account/session';
import { SegmentEvent, trackSegmentEvent } from '../../common/analytics';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC } from '../../common/constants';
import { database } from '../../common/database';
import * as models from '../../models';
import * as workspaceOperations from '../../models/helpers/workspace-operations';
import { DEFAULT_PROJECT_ID, isRemoteProject } from '../../models/project';
import { isCollection } from '../../models/workspace';
import { initializeLocalBackendProjectAndMarkForSync } from '../../sync/vcs/initialize-backend-project';
import { getVCS } from '../../sync/vcs/vcs';
// Project
export const createNewProjectAction: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');
  const project = await models.project.create({ name });
  trackSegmentEvent(SegmentEvent.projectLocalCreate);
  return redirect(`/project/${project._id}`);
};

export const renameProjectAction: ActionFunction = async ({
  request,
  params,
}) => {
  const formData = await request.formData();
  const name = formData.get('name');

  invariant(typeof name === 'string', 'Name is required');

  const { projectId } = params;
  invariant(typeof projectId === 'string', 'Project ID is required');

  const project = await models.project.getById(projectId);

  if (!project) {
    throw new Error('Project not found');
  }

  if (isRemoteProject(project)) {
    throw new Error('Cannot rename remote project');
  }

  await models.project.update(project, { name });
};

export const deleteProjectAction: ActionFunction = async ({ params }) => {
  const { projectId } = params;
  invariant(typeof projectId === 'string', 'Project ID is required');
  const project = await models.project.getById(projectId);
  if (!project) {
    throw new Error('Project not found');
  }
  await models.stats.incrementDeletedRequestsForDescendents(project);
  await models.project.remove(project);

  trackSegmentEvent(SegmentEvent.projectLocalDelete);
  return redirect(`/project/${DEFAULT_PROJECT_ID}`);
};

// Workspace
export const createNewWorkspaceAction: ActionFunction = async ({
  params,
  request,
}) => {
  const { projectId } = params;

  if (!projectId) {
    throw new Error('Invalid project ID');
  }

  const project = await models.project.getById(projectId);

  if (!project) {
    throw new Response('Project was not found', {
      status: 404,
      statusText: 'Not Found',
    });
  }

  const formData = await request.formData();
  const name = formData.get('name');
  const scope = formData.get('scope');
  invariant(typeof name === 'string', 'Name is required');
  invariant(scope === 'design' || scope === 'collection', 'Scope is required');

  const flushId = await database.bufferChanges();

  const workspace = await models.workspace.create({
    name,
    scope,
    parentId: projectId,
  });
  await models.workspace.ensureChildren(workspace);
  await models.workspaceMeta.getOrCreateByParentId(workspace._id);

  await database.flushChanges(flushId);
  if (session.isLoggedIn() && isRemoteProject(project)) {
    if (!isCollection(workspace)) {
      // Don't initialize and mark for sync unless we're in a collection
      return;
    }

    const vcs = getVCS();
    if (vcs) {
      initializeLocalBackendProjectAndMarkForSync({
        vcs,
        workspace,
      });
    }
  }

  trackSegmentEvent(
    isCollection(workspace)
      ? SegmentEvent.collectionCreate
      : SegmentEvent.documentCreate
  );

  return redirect(
    `/project/${projectId}/workspace/${workspace._id}/${
      workspace.scope === 'collection' ? ACTIVITY_DEBUG : ACTIVITY_SPEC
    }`
  );
};

export const deleteWorkspaceAction: ActionFunction = async ({
  params,
  request,
}) => {
  const { projectId } = params;

  invariant(projectId, 'projectId is required');

  const project = await models.project.getById(projectId);

  if (!project) {
    throw Error('Project was not found');
  }

  const formData = await request.formData();

  const workspaceId = formData.get('workspaceId');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const workspace = await models.workspace.getById(workspaceId);

  if (!workspace) {
    throw new Error('Workspace was not found');
  }

  await models.stats.incrementDeletedRequestsForDescendents(workspace);
  await models.workspace.remove(workspace);

  return redirect(`/project/${projectId}`);
};

export const duplicateWorkspaceAction: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const projectId = formData.get('projectId');
  const workspaceId = formData.get('workspaceId');

  invariant(typeof projectId === 'string', 'Project ID is required');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const workspace = await models.workspace.getById(workspaceId);

  if (!workspace) {
    throw new Error('Workspace was not found');
  }

  const name = formData.get('name') || '';
  invariant(typeof name === 'string', 'Name is required');
  const duplicateToProject = await models.project.getById(projectId);
  if (!duplicateToProject) {
    throw new Error('Project could not be found');
  }

  const newWorkspace = await workspaceOperations.duplicate(workspace, {
    name,
    parentId: projectId,
  });
  await models.workspace.ensureChildren(newWorkspace);

  // Mark for sync if logged in and in the expected project
  const vcs = getVCS();
  if (session.isLoggedIn() && vcs && isRemoteProject(duplicateToProject)) {
    await initializeLocalBackendProjectAndMarkForSync({
      vcs: vcs.newInstance(),
      workspace: newWorkspace,
    });
  }

  return redirect(
    `/project/${projectId}/workspace/${newWorkspace._id}/${
      newWorkspace.scope === 'collection' ? ACTIVITY_DEBUG : ACTIVITY_SPEC
    }`
  );
};

export const updateWorkspaceAction: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const workspaceId = formData.get('workspaceId');
  const name = formData.get('name');
  const description = formData.get('description');

  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  invariant(typeof name === 'string', 'Name is required');
  if (description) {
    invariant(typeof description === 'string', 'Description is required');
  }

  const workspace = await models.workspace.getById(workspaceId);

  if (workspace?.scope === 'design') {
    const apiSpec = await models.apiSpec.getByParentId(workspaceId);
    invariant(apiSpec, 'No Api Spec found for this workspace');

    await models.apiSpec.update(apiSpec, {
      fileName: name,
    });
  }

  if (!workspace) {
    throw new Error('No Workspace was found');
  }

  await models.workspace.update(workspace, {
    name,
    description: description || workspace.description,
  });
};
