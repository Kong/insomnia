import fs from 'node:fs';
import path from 'node:path';

import type { MockRouteData } from '@kong/insomnia-plugin-ai';
import { href, redirect } from 'react-router';

import { getAppVersion, getMockServiceURL, METHOD_GET } from '~/common/constants';
import { database } from '~/common/database';
import * as models from '~/models';
import { userSession } from '~/models';
import type { MockRoute } from '~/models/mock-route';
import type { MockServer } from '~/models/mock-server';
import { isGitProject, isLocalProject } from '~/models/project';
import { isCollection, isEnvironment, scopeToActivity, type WorkspaceScope } from '~/models/workspace';
import { safeToUseInsomniaFileNameWithExt } from '~/sync/git/insomnia-filename';
import { initializeLocalBackendProjectAndMarkForSync } from '~/sync/vcs/initialize-backend-project';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { SegmentEvent } from '~/ui/analytics';
import { showError } from '~/ui/components/modals';
import { showToast } from '~/ui/components/toast-notification';
import { insomniaFetch } from '~/ui/insomniaFetch';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.new';
import { mockRouteToHar } from './organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId';

interface NewWorkspaceData {
  name: string;
  scope: WorkspaceScope;
  folderPath?: string;
  mockServerType?: 'self-hosted' | 'cloud';
  mockServerUrl?: string;
  mockServerCreationType?: 'ai' | 'manual';
  mockServerOASFilePath?: string;
  mockServerSpecURL?: string;
  mockServerSpecSource?: 'file' | 'url' | 'text';
  mockServerSpecText?: string;
  mockServerAdditionalFiles?: string[];
  apiSpecContents?: string;
  fileName?: string;
  withRequest?: boolean;
  mockServerDynamicResponses?: boolean;
}

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

    if (scope === 'mock-server') {
      const mockServerType = workspaceData.mockServerType;
      invariant(mockServerType === 'cloud' || mockServerType === 'self-hosted', 'Mock Server type is required');

      const modelConfig = await window.main.llm.getCurrentConfig();
      if (workspaceData.mockServerCreationType === 'ai') {
        invariant(modelConfig, 'You must setup LLM configuration in your Preferences before using AI features.');

        const validationError = validateMockServerSpec(workspaceData);
        if (validationError) {
          return validationError;
        }

        if (workspaceData.mockServerSpecSource === 'url' || workspaceData.mockServerSpecSource === 'text') {
          invariant(modelConfig.backend !== 'gguf', 'The URL and Text options are not supported with GGUF models.');
        }
      }

      if (mockServerType === 'self-hosted') {
        const mockServerUrl = workspaceData.mockServerUrl;
        invariant(typeof mockServerUrl === 'string' && mockServerUrl.trim() !== '', 'Mock Server URL is required');
      }
    }

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
      showToast(
        {
          icon: 'magic',
          title: 'Creating mock server...',
          description: `Creating "${name}" - we'll notify you when it's ready!`,
          status: 'info',
        },
        { timeout: 5000 },
      );

      setTimeout(async () => {
        await continueMockServerCreation(workspace, workspaceData, flushId, organizationId, projectId, name);
      }, 100);

      // Return success response (modal will close via useEffect)
      return { error: undefined };
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

async function continueMockServerCreation(
  workspace: any,
  workspaceData: NewWorkspaceData,
  flushId: number,
  organizationId: string,
  projectId: string,
  name: string,
) {
  const mockServerType = workspaceData.mockServerType!;
  const mockServerPatch: Partial<MockServer> = {
    name,
  };

  if (mockServerType === 'cloud') {
    mockServerPatch.useInsomniaCloud = true;
  } else {
    mockServerPatch.useInsomniaCloud = false;
    mockServerPatch.url = workspaceData.mockServerUrl!;
  }

  await models.environment.getOrCreateForParentId(workspace._id);
  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
  const mockServer = await models.mockServer.getOrCreateForParentId(workspace._id, mockServerPatch);

  const mockServerUrl = `${href('/organization/:organizationId/project/:projectId/workspace/:workspaceId', {
    organizationId,
    projectId,
    workspaceId: workspace._id,
  })}/mock-server`;

  let mockRouteGenerationError: string | undefined;
  const generationStartTime = Date.now();

  if (workspaceData.mockServerCreationType === 'ai') {
    let openapiSpec: string | undefined;
    let specUrl: string | undefined;
    let specText: string | undefined;

    if (workspaceData.apiSpecContents) {
      openapiSpec = workspaceData.apiSpecContents;
    } else if (workspaceData.mockServerSpecSource === 'file') {
      openapiSpec = fs.readFileSync(workspaceData.mockServerOASFilePath!, 'utf8');
    } else if (workspaceData.mockServerSpecSource === 'url') {
      specUrl = workspaceData.mockServerSpecURL!;
    } else if (workspaceData.mockServerSpecSource === 'text') {
      specText = workspaceData.mockServerSpecText!;
    }

    const modelConfig = await window.main.llm.getCurrentConfig();
    const result = await window.main.generateMockRouteDataFromSpec(
      openapiSpec,
      specUrl,
      specText,
      modelConfig,
      workspaceData.mockServerDynamicResponses ?? false,
      workspaceData.mockServerAdditionalFiles || [],
    );

    if (result.error && result.error !== '') {
      mockRouteGenerationError = result.error;
    } else {
      const { id: sessionId } = await userSession.getOrCreate();
      await createMockRoutes(result.routes, mockServer, sessionId, organizationId);
    }
  }

  await database.flushChanges(flushId);

  const generationDurationMs = Date.now() - generationStartTime;

  showMockServerToast(mockRouteGenerationError, mockServer.name, mockServerUrl);

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
    properties: {
      hosting: workspaceData.mockServerType || '',
      generation: workspaceData.mockServerCreationType || '',
      generation_from: workspaceData.apiSpecContents ? 'design_doc' : workspaceData.mockServerSpecSource || '',
      dynamic_responses: workspaceData.mockServerDynamicResponses ? 'yes' : 'no',
      generation_duration_seconds: generationDurationMs / 1000,
    },
  });
}

function showMockServerToast(error: string | undefined, mockServerName: string, mockServerUrl: string) {
  if (error) {
    showToast(
      {
        icon: 'times-circle',
        title: 'Mock server creation partially failed',
        description: (
          <>
            <div style={{ marginBottom: '8px' }}>
              <a href={mockServerUrl} style={{ color: '#0066cc', textDecoration: 'underline', cursor: 'pointer' }}>
                "{mockServerName}" has been created, but mock server routes could not be fully populated from the spec.
              </a>
            </div>
            <a
              onClick={(e) => {
                e.preventDefault();
                showError({
                  title: 'Mock Route Generation Error',
                  message: error,
                });
              }}
              style={{ color: '#0066cc', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Click to view full error details.
            </a>
          </>
        ),
        status: 'error',
      },
      { timeout: 15000 },
    );
  } else {
    showToast(
      {
        icon: 'rocket',
        title: 'Mock server has been created',
        description: (
          <>
            <a href={mockServerUrl} style={{ color: '#0066cc', textDecoration: 'underline', cursor: 'pointer' }}>
              "{mockServerName}" has been created and is ready to use. Click to open.
            </a>
          </>
        ),
        status: 'success',
      },
      { timeout: 10000 },
    );
  }
}

function validateMockServerSpec(workspaceData: NewWorkspaceData) {
  if (workspaceData.apiSpecContents) {
    return null;
  }

  if (workspaceData.mockServerSpecSource === 'file' && !workspaceData.mockServerOASFilePath) {
    return {
      error: 'OpenAPI specification file is required when file source is selected',
    };
  }

  if (workspaceData.mockServerSpecSource === 'url' && !workspaceData.mockServerSpecURL) {
    return {
      error: 'URL is required when URL source is selected',
    };
  }

  if (workspaceData.mockServerSpecSource === 'text' && !workspaceData.mockServerSpecText) {
    return {
      error: 'Text input is required when text source is selected',
    };
  }

  return null;
}

async function createMockRoutes(
  routes: MockRouteData[],
  mockServer: MockServer,
  sessionId: string,
  organizationId: string,
) {
  for (const route of routes) {
    const mockRouteCreateData: Partial<MockRoute> = {
      parentId: mockServer._id,
      name: route.path,
      method: route.method,
      statusCode: route.statusCode,
      headers: route.headers,
      body: route.body || '',
    };

    if (route.mimeType !== undefined) {
      mockRouteCreateData.mimeType = route.mimeType;
    }

    const mockRoute = await models.mockRoute.create(mockRouteCreateData);

    try {
      const compoundId = mockRoute.parentId + mockRoute.name;
      const mockbinUrl = mockServer.useInsomniaCloud ? getMockServiceURL() : mockServer.url;

      if (mockbinUrl && sessionId) {
        await insomniaFetch({
          origin: mockbinUrl,
          path: `/bin/upsert/${compoundId}`,
          method: 'PUT',
          organizationId,
          sessionId,
          headers: {
            'insomnia-mock-method': route.method,
          },
          data: mockRouteToHar({
            statusCode: mockRoute.statusCode,
            statusText: mockRoute.statusText || '',
            headersArray: mockRoute.headers,
            mimeType: mockRoute.mimeType || '',
            body: mockRoute.body || '',
          }),
        });
      }
    } catch (error) {
      const msg = `Failed to register route ${mockRoute.method} ${mockRoute.name}:`
      console.error(msg, error);
    }
  }
}
