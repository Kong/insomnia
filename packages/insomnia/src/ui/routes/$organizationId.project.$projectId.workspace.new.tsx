import path from 'node:path';

import { type ActionFunctionArgs, redirect } from 'react-router';

import { version } from '../../../package.json';
import { METHOD_GET } from '../../common/constants';
import { database } from '../../common/database';
import * as models from '../../models';
import type { MockServer } from '../../models/mock-server';
import { isGitProject } from '../../models/project';
import { isCollection, isEnvironment, scopeToActivity } from '../../models/workspace';
import { safeToUseInsomniaFileNameWithExt } from '../../sync/git/insomnia-filename';
import { initializeLocalBackendProjectAndMarkForSync } from '../../sync/vcs/initialize-backend-project';
import { VCSInstance } from '../../sync/vcs/insomnia-sync';
import { invariant } from '../../utils/invariant';
import { SegmentEvent } from '../analytics';

export async function action({ request, params }: ActionFunctionArgs) {
  const { organizationId, projectId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');

  const project = await models.project.getById(projectId);

  invariant(project, 'Project not found');

  const formData = await request.formData();

  const name = formData.get('name');

  invariant(typeof name === 'string', 'Name is required');

  const scope = formData.get('scope');
  invariant(
    scope === 'design' || scope === 'collection' || scope === 'mock-server' || scope === 'environment',
    'Scope is required',
  );

  const flushId = await database.bufferChanges();

  const workspaceName = name || (scope === 'collection' ? 'My Collection' : 'my-spec.yaml');

  const workspace = await models.workspace.create({
    name: workspaceName,
    scope,
    parentId: projectId,
  });

  if (isGitProject(project)) {
    const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);

    const fileName = formData.get('fileName')?.toString() || workspace.name;

    const safeToUseFileNameWithExtension = safeToUseInsomniaFileNameWithExt(fileName);

    await models.workspaceMeta.update(workspaceMeta, {
      gitFilePath: path.join(formData.get('folderPath')?.toString() || '', safeToUseFileNameWithExtension),
    });
  }

  if (scope === 'mock-server') {
    const mockServerType = formData.get('mockServerType');
    invariant(mockServerType === 'cloud' || mockServerType === 'self-hosted', 'Mock Server type is required');

    const mockServerPatch: Partial<MockServer> = {
      name,
    };

    if (mockServerType === 'cloud') {
      mockServerPatch.useInsomniaCloud = true;
    }

    if (mockServerType === 'self-hosted') {
      const mockServerUrl = formData.get('mockServerUrl');
      invariant(typeof mockServerUrl === 'string', 'Mock Server URL is required');
      mockServerPatch.useInsomniaCloud = false;
      mockServerPatch.url = mockServerUrl;
    }

    await models.environment.getOrCreateForParentId(workspace._id);
    const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
    await models.mockServer.getOrCreateForParentId(workspace._id, mockServerPatch);
    await database.flushChanges(flushId);

    const { id } = await models.userSession.getOrCreate();
    if (id && !workspaceMeta.gitRepositoryId) {
      const vcs = VCSInstance();
      await initializeLocalBackendProjectAndMarkForSync({
        vcs,
        workspace,
      });
    }
    window.main.trackSegmentEvent({
      event: SegmentEvent.mockCreate,
    });
    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/${scopeToActivity(workspace.scope)}`,
    );
  }

  if (scope === 'design') {
    await models.apiSpec.getOrCreateForParentId(workspace._id);
  }

  // Create default env, cookie jar, and meta
  await models.environment.getOrCreateForParentId(workspace._id);
  await models.cookieJar.getOrCreateForParentId(workspace._id);
  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);

  await database.flushChanges(flushId);

  const { id } = await models.userSession.getOrCreate();
  if (id && !workspaceMeta.gitRepositoryId && !isGitProject(project)) {
    const vcs = VCSInstance();
    await initializeLocalBackendProjectAndMarkForSync({
      vcs,
      workspace,
    });
  }

  let event = SegmentEvent.documentCreate;

  if (isCollection(workspace)) {
    event = SegmentEvent.collectionCreate;
  } else if (isEnvironment(workspace)) {
    event = SegmentEvent.environmentWorkspaceCreate;
  }

  window.main.trackSegmentEvent({
    event: event,
  });

  // Parse the URL from the request
  const url = new URL(request.url);

  // Get a specific query parameter
  const withRequest = url.searchParams.get('withRequest');

  if (withRequest) {
    const settings = await models.settings.getOrCreate();
    const defaultHeaders = settings.disableAppVersionUserAgent
      ? []
      : [{ name: 'User-Agent', value: `insomnia/${version}` }];

    const activeRequestId = (
      await models.request.create({
        parentId: workspace._id,
        method: METHOD_GET,
        name: 'My first request',
        headers: defaultHeaders,
      })
    )._id;

    window.main.trackSegmentEvent({ event: SegmentEvent.requestCreate, properties: { requestType: 'HTTP' } });

    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/debug/request/${activeRequestId}`,
    );
  }

  return redirect(
    `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/${scopeToActivity(workspace.scope)}`,
  );
}
