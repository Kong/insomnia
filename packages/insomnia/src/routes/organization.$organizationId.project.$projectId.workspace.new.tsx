import { upsertMockbin } from 'insomnia-api';
import type { MockRoute, MockServer, WorkspaceScope } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { href, redirect } from 'react-router';

import { getMockServiceURL, METHOD_GET } from '~/common/constants';
import { database } from '~/common/database';
import type { MockRouteData } from '~/common/plugins/types';
import { invariant } from '~/common/utils/invariant';
import { safeToUseInsomniaFileNameWithExt } from '~/sync/git/insomnia-filename';
import { AnalyticsEvent } from '~/ui/analytics';
import { showToast } from '~/ui/components/toast-notification';
import { trackCioEvent } from '~/ui/hooks/use-cio';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.new';
import { mockRouteToHar } from './organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId';

interface NewWorkspaceData {
  name: string;
  scope: WorkspaceScope;
  mcpServerUrl?: string;
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
  source?: string;
}

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId, projectId } = params;
  try {
    const redirectAfterCreate = new URL(request.url).searchParams.get('redirectAfterCreate') !== 'false';
    const workspaceData = (await request.json()) as NewWorkspaceData;
    const project = await services.project.get(projectId);

    invariant(project, 'Project not found');

    const name = workspaceData.name;

    invariant(typeof name === 'string', 'Name is required');

    const scope = workspaceData.scope;
    invariant(
      scope === 'design' ||
        scope === 'collection' ||
        scope === 'mock-server' ||
        scope === 'environment' ||
        scope === 'mcp',
      'Scope is required',
    );

    if (scope === 'mock-server') {
      const mockServerType = workspaceData.mockServerType;
      invariant(mockServerType === 'cloud' || mockServerType === 'self-hosted', 'Mock Server type is required');

      const modelConfig = await window.main.llm.getCurrentConfig();
      if (workspaceData.mockServerCreationType === 'ai') {
        const isFeatureEnabled = await window.main.llm.getAIFeatureEnabled('aiMockServers');
        invariant(
          isFeatureEnabled,
          'Enable generating mock servers with AI in Insomnia Preferences → AI Settings to use this feature.',
        );

        const validationError = validateMockServerSpec(workspaceData);
        if (validationError) {
          return validationError;
        }

        if (workspaceData.mockServerSpecSource === 'url' || workspaceData.mockServerSpecSource === 'text') {
          invariant(
            modelConfig && modelConfig.backend !== 'gguf',
            'The URL and Text options are not supported with GGUF models.',
          );
        }
      }

      if (mockServerType === 'self-hosted') {
        const mockServerUrl = workspaceData.mockServerUrl;
        invariant(typeof mockServerUrl === 'string' && mockServerUrl.trim() !== '', 'Mock Server URL is required');
      }
    }

    const flushId = await database.bufferChanges();

    const workspaceName = name || (scope === 'collection' ? 'My Collection' : 'my-spec.yaml');

    const workspace = await services.workspace.create({
      name: workspaceName,
      scope,
      parentId: projectId,
    });

    if (models.project.isGitProject(project)) {
      const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspace._id);

      const fileName = workspaceData.fileName || workspace.name;

      const safeToUseFileNameWithExtension = safeToUseInsomniaFileNameWithExt(fileName);

      await services.workspaceMeta.update(workspaceMeta, {
        gitFilePath: window.path.join(workspaceData.folderPath || '', safeToUseFileNameWithExtension),
      });
    }

    if (scope === 'mock-server') {
      const mockServerError = await createMockServer(
        workspace,
        workspaceData,
        flushId,
        organizationId,
        projectId,
        name,
        workspaceData.source,
      );

      if (mockServerError) {
        return { error: mockServerError };
      }

      return { error: undefined };
    }

    if (scope === 'design') {
      await services.apiSpec.getOrCreateForParentId(workspace._id);
    }

    if (workspaceData.scope === 'mcp') {
      // Create mcp request when MCP workspace is created
      await services.mcpRequest.create({
        parentId: workspace._id,
        transportType: 'streamable-http',
        url: workspaceData.mcpServerUrl?.trim() || '',
        name: 'MCP Client',
        headers: [],
        description: '',
      });

      window.main.trackAnalyticsEvent({
        event: AnalyticsEvent.mcpClientAdded,
      });
    }

    // Create default env, cookie jar, and meta
    await services.environment.getOrCreateForParentId(workspace._id);
    await services.cookieJar.getOrCreateForParentId(workspace._id);
    const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspace._id);

    await database.flushChanges(flushId);

    const { id } = await services.userSession.get();
    if (
      id &&
      !workspaceMeta.gitRepositoryId &&
      !models.project.isGitProject(project) &&
      !models.project.isLocalProject(project)
    ) {
      await window.main.initializeWorkspaceBackendProject({
        workspaceId: workspace._id,
      });
    }

    let event = AnalyticsEvent.documentCreate;
    let environmentType: string | undefined;

    if (models.workspace.isCollection(workspace)) {
      event = AnalyticsEvent.collectionCreate;
    } else if (models.workspace.isEnvironment(workspace)) {
      event = AnalyticsEvent.environmentCreate;
      const environment = await services.environment.getById(workspace._id);
      environmentType = environment?.isPrivate ? 'private' : 'global';
    } else if (scope === 'mcp') {
      event = AnalyticsEvent.mcpClientWorkspaceCreate;
    }

    window.main.trackAnalyticsEvent({
      event: event,
      properties: {
        ...(environmentType && { type: environmentType }),
        ...(workspaceData.source && { source: workspaceData.source }),
      },
    });

    if (workspaceData.withRequest) {
      const activeRequestId = (
        await services.request.create({
          parentId: workspace._id,
          method: METHOD_GET,
          name: 'My first request',
          headers: [],
        })
      )._id;

      const requestCreatedProperties = {
        requestType: 'HTTP',
        ...(workspaceData.source && { source: workspaceData.source }),
      };
      window.main.trackAnalyticsEvent({
        event: AnalyticsEvent.requestCreated,
        properties: requestCreatedProperties,
      });

      // Send to Customer.io directly so the event is tied to the identified
      // user's email-bearing profile (only fires when logged in). See INS-2678.
      trackCioEvent(AnalyticsEvent.requestCreated, requestCreatedProperties);

      if (!redirectAfterCreate) {
        return {
          workspaceId: workspace._id,
          requestId: activeRequestId,
        };
      }

      return redirect(
        href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId`, {
          organizationId,
          projectId,
          workspaceId: workspace._id,
          requestId: activeRequestId,
        }),
      );
    }

    if (!redirectAfterCreate) {
      return {
        workspaceId: workspace._id,
      };
    }

    return redirect(
      `${href('/organization/:organizationId/project/:projectId/workspace/:workspaceId', {
        organizationId,
        projectId,
        workspaceId: workspace._id,
      })}/${models.workspace.scopeToActivity(workspace.scope)}`,
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
      redirectAfterCreate,
      ...workspaceData
    }: NewWorkspaceData & { organizationId: string; projectId: string; redirectAfterCreate?: boolean }) => {
      const action = href('/organization/:organizationId/project/:projectId/workspace/new', {
        organizationId,
        projectId,
      });
      const query = new URLSearchParams();

      if (redirectAfterCreate !== undefined) {
        query.set('redirectAfterCreate', String(redirectAfterCreate));
      }

      return submit(JSON.stringify(workspaceData), {
        method: 'POST',
        action: query.toString() ? `${action}?${query.toString()}` : action,
        encType: 'application/json',
      });
    },
  clientAction,
);

async function createMockServer(
  workspace: any,
  workspaceData: NewWorkspaceData,
  flushId: number,
  organizationId: string,
  projectId: string,
  name: string,
  source?: string,
): Promise<string | undefined> {
  try {
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

    await services.environment.getOrCreateForParentId(workspace._id);
    const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspace._id);
    const mockServer = await services.mockServer.getOrCreateForParentId(workspace._id, mockServerPatch);

    const mockServerUrl = `${href('/organization/:organizationId/project/:projectId/workspace/:workspaceId', {
      organizationId,
      projectId,
      workspaceId: workspace._id,
    })}/mock-server`;

    const modelConfig = await window.main.llm.getCurrentConfig();

    const generationStartTime = Date.now();

    if (workspaceData.mockServerCreationType === 'ai') {
      let openapiSpec: string | undefined;
      let specUrl: string | undefined;
      let specText: string | undefined;

      if (workspaceData.apiSpecContents) {
        openapiSpec = workspaceData.apiSpecContents;
      } else if (workspaceData.mockServerSpecSource === 'file') {
        const { content, error } = await window.main.insecureReadFileWithEncoding({
          path: workspaceData.mockServerOASFilePath!,
          encoding: 'utf8',
        });

        if (error) {
          throw new Error(String(error));
        }

        openapiSpec = content;
      } else if (workspaceData.mockServerSpecSource === 'url') {
        specUrl = workspaceData.mockServerSpecURL!;
      } else if (workspaceData.mockServerSpecSource === 'text') {
        specText = workspaceData.mockServerSpecText!;
      }

      const result = await window.main.generateMockRouteDataFromSpec(
        openapiSpec,
        specUrl,
        specText,
        modelConfig,
        workspaceData.mockServerDynamicResponses ?? false,
        workspaceData.mockServerAdditionalFiles || [],
      );

      if (result.error && result.error !== '') {
        try {
          await services.workspace.remove(workspace);
        } catch (removeError) {
          console.error('Failed to rollback workspace creation:', removeError);
        }
        return result.error;
      }

      const { id: sessionId } = await services.userSession.get();
      await createMockRoutes(result.routes, mockServer, sessionId, organizationId);
    }

    await database.flushChanges(flushId);

    const generationDurationMs = Date.now() - generationStartTime;

    const { id } = await services.userSession.get();
    if (id && !workspaceMeta.gitRepositoryId) {
      await window.main.initializeWorkspaceBackendProject({
        workspaceId: workspace._id,
      });
    }

    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.mockCreate,
      properties: {
        provider: (modelConfig && modelConfig.backend) || '',
        model: (modelConfig && modelConfig.model) || '',
        hosting: workspaceData.mockServerType || '',
        generation: workspaceData.mockServerCreationType || '',
        generation_from: workspaceData.apiSpecContents ? 'design_doc' : workspaceData.mockServerSpecSource || '',
        dynamic_responses: workspaceData.mockServerDynamicResponses ? 'yes' : 'no',
        generation_duration_seconds: generationDurationMs / 1000,
        ...(source && { source }),
      },
    });

    showToast(
      {
        icon: 'rocket',
        title: 'Mock server has been created',
        description: (
          <>
            <a href={mockServerUrl} style={{ color: '#0066cc', textDecoration: 'underline', cursor: 'pointer' }}>
              "{mockServer.name}" has been created and is ready to use. Click to open.
            </a>
          </>
        ),
        status: 'success',
      },
      { timeout: 10_000 },
    );

    return undefined;
  } catch (error) {
    try {
      await services.workspace.remove(workspace);
    } catch (removeError) {
      console.error('Failed to rollback workspace creation:', removeError);
    }
    return error instanceof Error ? error.message : String(error);
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

    const mockRoute = await services.mockRoute.create(mockRouteCreateData);

    try {
      const compoundId = mockRoute.parentId + mockRoute.name;
      const mockbinUrl = mockServer.useInsomniaCloud ? getMockServiceURL() : mockServer.url;

      if (mockbinUrl && sessionId) {
        await upsertMockbin({
          mockbinUrl,
          compoundId,
          organizationId,
          sessionId,
          method: route.method,
          data: await mockRouteToHar({
            statusCode: mockRoute.statusCode,
            statusText: mockRoute.statusText || '',
            headersArray: mockRoute.headers,
            mimeType: mockRoute.mimeType || '',
            body: mockRoute.body || '',
          }),
        });
      }
    } catch (error) {
      const msg = `Failed to register route ${mockRoute.method} ${mockRoute.name}:`;
      console.error(msg, error);
    }
  }
}
