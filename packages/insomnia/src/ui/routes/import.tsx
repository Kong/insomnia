// Import
import { clipboard } from 'electron';
import { ActionFunction, redirect } from 'react-router-dom';

import { isLoggedIn } from '../../account/session';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC } from '../../common/constants';
import { database } from '../../common/database';
import { fetchImportContentFromURI, importRaw, importResources, importUri, scanResources } from '../../common/import';
import * as models from '../../models';
import { isRemoteProject } from '../../models/project';
import { isCollection, isWorkspace, WorkspaceScope } from '../../models/workspace';
import { initializeLocalBackendProjectAndMarkForSync } from '../../sync/vcs/initialize-backend-project';
import { getVCS } from '../../sync/vcs/vcs';
import { invariant } from '../../utils/invariant';
import { SegmentEvent, trackSegmentEvent } from '../analytics';

function guard<T>(condition: any, value: any): asserts value is T {
  if (!condition) {
    throw new Error('Guard failed');
  }
}

export const importFileAction: ActionFunction = async ({ request }) => {
  const formData = await request.formData();

  const organizationId = formData.get('organizationId');
  const workspaceId = formData.get('workspaceId');
  const projectId = formData.get('projectId');
  const scope = formData.get('scope') || 'design';
  const filePaths = formData.getAll('filePath');

  invariant(typeof projectId === 'string', 'ProjectId is required.');
  invariant(typeof workspaceId === 'string', 'WorkspaceId is required.');
  invariant(typeof scope === 'string', 'Scope is required.');
  invariant(typeof organizationId === 'string', 'OrganizationId is required.');
  guard<WorkspaceScope>(scope === 'design' || scope === 'collection', scope);
  guard<string[]>(typeof filePaths[0] === 'string', filePaths);

  const project = await models.project.getById(projectId);

  if (!project) {
    throw new Error('Project not found.');
  }

  let workspace = await models.workspace.getById(workspaceId);

  if (!workspace && workspaceId === 'create-new-workspace-id') {
    const name = formData.get('name');
    invariant(typeof name === 'string', 'Name is required.');

    const flushId = await database.bufferChanges();

    workspace = await models.workspace.create({
      name,
      scope,
      parentId: projectId,
    });

    await models.workspaceMeta.getOrCreateByParentId(workspace._id);

    await database.flushChanges(flushId);
    if (isLoggedIn() && isRemoteProject(project)) {
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
  }

  if (!workspace) {
    throw new Error('Workspace not found.');
  }

  const importFromFilePath = async (filePath: string) => {
    const uri = `file://${filePath}`;
    const result = await importUri(uri, {
      getWorkspaceScope: () => Promise.resolve(scope),
      getProjectId: () => Promise.resolve(projectId),
      getWorkspaceId: () => Promise.resolve(workspace?._id || ''),
    });

    const { error, summary } = result;

    if (error) {
      throw new Error('The URI does not contain a valid specification.');
    }

    await models.stats.incrementRequestStats({
      createdRequests:
        summary[models.request.type].length +
        summary[models.grpcRequest.type].length,
    });

    console.log(summary[models.workspace.type].filter(isWorkspace));
  };
  // Import all selected files in parallel
  await Promise.all(filePaths.map(importFromFilePath));

  return redirect(`/organization/${organizationId}/project/${project._id}/workspace/${workspace._id}/${scope === 'design' ? ACTIVITY_SPEC : ACTIVITY_DEBUG}`);
};

export const importUriAction: ActionFunction = async ({ request }) => {
  const formData = await request.formData();

  const organizationId = formData.get('organizationId');
  const projectId = formData.get('projectId');
  const workspaceId = formData.get('workspaceId');
  const uri = formData.get('uri');
  const scope = formData.get('scope') || 'design';

  invariant(typeof organizationId === 'string', 'OrganizationId is required.');
  invariant(typeof uri === 'string', 'URI is required.');
  invariant(typeof projectId === 'string', 'ProjectId is required.');
  invariant(typeof workspaceId === 'string', 'WorkspaceId is required.');
  invariant(typeof scope === 'string', 'Scope is required.');
  guard<WorkspaceScope>(scope === 'design' || scope === 'collection', scope);

  const project = await models.project.getById(projectId);
  let workspace = await models.workspace.getById(workspaceId);

  if (!workspace && workspaceId === 'create-new-workspace-id') {
    const name = formData.get('name');
    invariant(typeof name === 'string', 'Name is required.');
    workspace = await models.workspace.create({
      name,
      scope,
      parentId: projectId,
    });
  }

  if (!project || !workspace) {
    throw new Response('Project or workspace not found.', {
      status: 404,
      statusText: 'Not Found',
    });
  }

  const result = await importUri(uri, {
    getWorkspaceScope: () => Promise.resolve(scope),
    getProjectId: () => Promise.resolve(projectId),
    getWorkspaceId: () => Promise.resolve(workspace?._id || ''),
  });

  const { error, summary } = result;

  if (error) {
    throw new Error('The URI does not contain a valid specification.');
  }

  await models.stats.incrementRequestStats({
    createdRequests:
      summary[models.request.type].length +
      summary[models.grpcRequest.type].length,
  });

  console.log(summary[models.workspace.type].filter(isWorkspace));
  return redirect(`/organization/${organizationId}/project/${project._id}/workspace/${workspace._id}/${scope === 'design' ? ACTIVITY_SPEC : ACTIVITY_DEBUG}`);
};

export const importClipboardAction: ActionFunction = async ({ request }) => {

  const schema = clipboard.readText();
  if (!schema) {
    throw new Error('Clipboard does not contain a valid specification');
  }

  const formData = await request.formData();

  const organizationId = formData.get('organizationId');
  const projectId = formData.get('projectId');
  const workspaceId = formData.get('workspaceId');
  const scope = formData.get('scope') || 'design';

  invariant(typeof organizationId === 'string', 'OrganizationId is required.');
  invariant(typeof projectId === 'string', 'ProjectId is required.');
  invariant(typeof workspaceId === 'string', 'WorkspaceId is required.');
  invariant(typeof scope === 'string', 'Scope is required.');
  guard<WorkspaceScope>(scope === 'design' || scope === 'collection', scope);

  const project = await models.project.getById(projectId);
  let workspace = await models.workspace.getById(workspaceId);

  if (!workspace && workspaceId === 'create-new-workspace-id') {
    const name = formData.get('name');
    invariant(typeof name === 'string', 'Name is required.');
    workspace = await models.workspace.create({
      name,
      scope,
      parentId: projectId,
    });
  }

  if (!project || !workspace) {
    throw new Error('Project or Workspace not found.');
  }

  const result = await importRaw(schema, {
    getWorkspaceScope: () => Promise.resolve(scope),
    getProjectId: () => Promise.resolve(projectId),
    getWorkspaceId: () => Promise.resolve(workspace?._id || ''),
  });

  const { error, summary } = result;

  if (error) {
    throw new Error('Your clipboard does not contain a valid specification.');
  }

  await models.stats.incrementRequestStats({
    createdRequests:
      summary[models.request.type].length +
      summary[models.grpcRequest.type].length,
  });

  console.log(summary[models.workspace.type].filter(isWorkspace));
  return redirect(`/organization/${organizationId}/project/${project._id}/workspace/${workspace._id}/${scope === 'design' ? ACTIVITY_SPEC : ACTIVITY_DEBUG}`);
};

export const scanForResourcesAction: ActionFunction = async ({ request }) => {
  const formData = await request.formData();

  const source = formData.get('importFrom');
  invariant(typeof source === 'string', 'Source is required.');
  guard<'file' | 'uri' | 'clipboard'>(source, ['file', 'uri', 'clipboard'].includes(source));

  let content = '';
  if (source === 'uri') {
    const uri = formData.get('uri');
    invariant(typeof uri === 'string', 'URI is required.');

    content = await fetchImportContentFromURI({
      uri,
    });
  } else if (source === 'file') {
    const filePath = formData.get('filePath');
    invariant(typeof filePath === 'string', 'URI is required.');
    const uri = `file://${filePath}`;

    content = await fetchImportContentFromURI({
      uri,
    });
  } else {
    content = clipboard.readText();
  }

  if (!content) {
    throw new Error('The URI does not contain a valid specification.');
  }

  const result = await scanResources({ content });

  return result;
};

export const importResourcesAction: ActionFunction = async ({ request }) => {
  const formData = await request.formData();

  const resourceIds = formData.getAll('resourceId') as string[];

  const organizationId = formData.get('organizationId');
  const projectId = formData.get('projectId');
  const workspaceId = formData.get('workspaceId');
  const scope = formData.get('scope') || 'design';

  console.log({ resourceIds });

  invariant(typeof organizationId === 'string', 'OrganizationId is required.');
  invariant(typeof projectId === 'string', 'ProjectId is required.');
  invariant(typeof workspaceId === 'string', 'WorkspaceId is required.');
  invariant(typeof scope === 'string', 'Scope is required.');

  guard<WorkspaceScope>(scope === 'design' || scope === 'collection', scope);

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found.');
  let workspace = await models.workspace.getById(workspaceId);

  if (!workspace && workspaceId === 'create-new-workspace-id') {
    const name = formData.get('name');
    invariant(typeof name === 'string', 'Name is required.');
    workspace = await models.workspace.create({
      name,
      scope,
      parentId: projectId,
    });
  }

  invariant(workspace, 'Workspace not found.');

  const result = await importResources({
    resourceIds,
    projectId: project._id,
    workspaceId: workspace._id,
  });

  return result;
};
