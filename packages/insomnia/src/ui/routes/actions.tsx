import { invariant } from '@remix-run/router';
import { ActionFunction, redirect } from 'react-router-dom';

import * as session from '../../account/session';
import { SegmentEvent, trackSegmentEvent } from '../../common/analytics';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC } from '../../common/constants';
import { database } from '../../common/database';
import * as models from '../../models';
import * as workspaceOperations from '../../models/helpers/workspace-operations';
import { DEFAULT_ORGANIZATION_ID } from '../../models/organization';
import { DEFAULT_PROJECT_ID, isRemoteProject } from '../../models/project';
import { isCollection } from '../../models/workspace';
import { initializeLocalBackendProjectAndMarkForSync } from '../../sync/vcs/initialize-backend-project';
import { getVCS } from '../../sync/vcs/vcs';

// Project
export const createNewProjectAction: ActionFunction = async ({ request, params }) => {
  const { organizationId } = params;
  invariant(organizationId, 'Organization ID is required');
  const formData = await request.formData();
  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');
  const project = await models.project.create({ name });
  trackSegmentEvent(SegmentEvent.projectLocalCreate);
  return redirect(`/organization/${organizationId}/project/${project._id}`);
};

export const renameProjectAction: ActionFunction = async ({
  request,
  params,
}) => {
  const formData = await request.formData();

  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');

  const { projectId } = params;
  invariant(projectId, 'Project ID is required');

  const project = await models.project.getById(projectId);

  invariant(project, 'Project not found');

  invariant(
    !isRemoteProject(project),
    'Cannot rename remote project',
  );

  await models.project.update(project, { name });
};

export const deleteProjectAction: ActionFunction = async ({ params }) => {
  const { organizationId, projectId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');
  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  await models.stats.incrementDeletedRequestsForDescendents(project);
  await models.project.remove(project);

  trackSegmentEvent(SegmentEvent.projectLocalDelete);

  return redirect(`/organization/${DEFAULT_ORGANIZATION_ID}/project/${DEFAULT_PROJECT_ID}`);
};

// Workspace
export const createNewWorkspaceAction: ActionFunction = async ({
  params,
  request,
}) => {
  const { organizationId, projectId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');

  const project = await models.project.getById(projectId);

  invariant(project, 'Project not found');

  const formData = await request.formData();

  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');

  const scope = formData.get('scope');
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
  if (session.isLoggedIn() && isRemoteProject(project) && isCollection(workspace)) {
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
    `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/${
      workspace.scope === 'collection' ? ACTIVITY_DEBUG : ACTIVITY_SPEC
    }`
  );
};

export const deleteWorkspaceAction: ActionFunction = async ({
  params,
  request,
}) => {
  const { organizationId, projectId } = params;
  invariant(projectId, 'projectId is required');

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  const formData = await request.formData();

  const workspaceId = formData.get('workspaceId');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  await models.stats.incrementDeletedRequestsForDescendents(workspace);
  await models.workspace.remove(workspace);

  try {
    const vcs = getVCS();
    if (vcs) {
      const backendProject = await vcs._getBackendProjectByRootDocument(workspace._id);
      await vcs._removeProject(backendProject);

      console.log({ projectsLOCAL: await vcs.localBackendProjects() });
    }
  } catch (err) {
    console.warn('Failed to remove project from VCS', err);
  }

  return redirect(`/organization/${organizationId}/project/${projectId}`);
};

export const duplicateWorkspaceAction: ActionFunction = async ({ request, params }) => {
  const { organizationId } = params;
  invariant(organizationId, 'Organization Id is required');
  const formData = await request.formData();
  const projectId = formData.get('projectId');
  invariant(typeof projectId === 'string', 'Project ID is required');

  const workspaceId = formData.get('workspaceId');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const name = formData.get('name') || '';
  invariant(typeof name === 'string', 'Name is required');

  const duplicateToProject = await models.project.getById(projectId);
  invariant(duplicateToProject, 'Project not found');

  const newWorkspace = await workspaceOperations.duplicate(workspace, {
    name,
    parentId: projectId,
  });

  await models.workspace.ensureChildren(newWorkspace);

  try {
    // Mark for sync if logged in and in the expected project
    const vcs = getVCS();
    if (session.isLoggedIn() && vcs && isRemoteProject(duplicateToProject)) {
      await initializeLocalBackendProjectAndMarkForSync({
        vcs: vcs.newInstance(),
        workspace: newWorkspace,
      });
    }
  } catch (e) {
    console.warn('Failed to initialize local backend project', e);
  }

  return redirect(
    `/organization/${organizationId}/project/${projectId}/workspace/${newWorkspace._id}/${
      newWorkspace.scope === 'collection' ? ACTIVITY_DEBUG : ACTIVITY_SPEC
    }`
  );
};

export const updateWorkspaceAction: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const workspaceId = formData.get('workspaceId');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');

  const description = formData.get('description');
  if (description) {
    invariant(typeof description === 'string', 'Description is required');
  }

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  if (workspace.scope === 'design') {
    const apiSpec = await models.apiSpec.getByParentId(workspaceId);
    invariant(apiSpec, 'No Api Spec found for this workspace');

    await models.apiSpec.update(apiSpec, {
      fileName: name,
    });
  }

  await models.workspace.update(workspace, {
    name,
    description: description || workspace.description,
  });
};
