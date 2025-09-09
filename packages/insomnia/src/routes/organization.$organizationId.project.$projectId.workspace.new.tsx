import path from 'node:path';

import { href, redirect } from 'react-router';

import { getAppVersion, METHOD_GET } from '~/common/constants';
import { database } from '~/common/database';
import * as models from '~/models';
import type { MockServer } from '~/models/mock-server';
import { isGitProject, isLocalProject } from '~/models/project';
import { isCollection, isEnvironment, scopeToActivity, type WorkspaceScope } from '~/models/workspace';
import { safeToUseInsomniaFileNameWithExt } from '~/sync/git/insomnia-filename';
import { initializeLocalBackendProjectAndMarkForSync } from '~/sync/vcs/initialize-backend-project';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { SegmentEvent } from '~/ui/analytics';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

interface NewWorkspaceData {
  name: string;
  scope: WorkspaceScope;
  folderPath?: string;
  mockServerType?: 'self-hosted' | 'cloud';
  mockServerUrl?: string;
  fileName?: string;
  withRequest?: boolean;
}

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.new';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId, projectId } = params;
  try {
    const workspaceData = (await request.json()) as NewWorkspaceData;
    const project = await models.project.getById(projectId);

    invariant(project, 'Project not found');

    const name = workspaceData.name;

    invariant(typeof name === 'string', 'Name is required');

    const scope = workspaceData.scope;
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

      const fileName = workspaceData.fileName || workspace.name;

      const safeToUseFileNameWithExtension = safeToUseInsomniaFileNameWithExt(fileName);

      await models.workspaceMeta.update(workspaceMeta, {
        gitFilePath: path.join(workspaceData.folderPath || '', safeToUseFileNameWithExtension),
      });
    }

    if (scope === 'mock-server') {
      const mockServerType = workspaceData.mockServerType;
      invariant(mockServerType === 'cloud' || mockServerType === 'self-hosted', 'Mock Server type is required');

      const mockServerPatch: Partial<MockServer> = {
        name,
      };

      if (mockServerType === 'cloud') {
        mockServerPatch.useInsomniaCloud = true;
      }

      if (mockServerType === 'self-hosted') {
        const mockServerUrl = workspaceData.mockServerUrl;
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
        `${href('/organization/:organizationId/project/:projectId/workspace/:workspaceId', {
          organizationId,
          projectId,
          workspaceId: workspace._id,
        })}/${scopeToActivity(workspace.scope)}`,
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
    if (id && !workspaceMeta.gitRepositoryId && !isGitProject(project) && !isLocalProject(project)) {
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

    if (workspaceData.withRequest) {
      const settings = await models.settings.getOrCreate();
      const defaultHeaders = settings.disableAppVersionUserAgent
        ? []
        : [{ name: 'User-Agent', value: `insomnia/${getAppVersion()}` }];

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
        href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId`, {
          organizationId,
          projectId,
          workspaceId: workspace._id,
          requestId: activeRequestId,
        }),
      );
    }

    return redirect(
      `${href('/organization/:organizationId/project/:projectId/workspace/:workspaceId', {
        organizationId,
        projectId,
        workspaceId: workspace._id,
      })}/${scopeToActivity(workspace.scope)}`,
    );
  } catch (err) {
    console.error('Error creating workspace:', err);

    return {
      error: `Failed to create workspace: ${err instanceof Error ? err.message : JSON.stringify(err)}`,
    };
  }
}

export const useWorkspaceNewActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      ...workspaceData
    }: NewWorkspaceData & { organizationId: string; projectId: string }) => {
      return submit(JSON.stringify(workspaceData), {
        method: 'POST',
        action: href('/organization/:organizationId/project/:projectId/workspace/new', {
          organizationId,
          projectId,
        }),
        encType: 'application/json',
      });
    },
  clientAction,
);
