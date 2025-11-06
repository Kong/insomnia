import {
  auth,
  type AuthResult,
  extractResourceMetadataUrl,
  UnauthorizedError,
} from '@modelcontextprotocol/sdk/client/auth.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { BrowserWindow } from 'electron';

import { timelineFileStreams, writeEventLogAndNotify } from '~/main/mcp/common';
import { type McpOAuthClientProvider } from '~/main/mcp/oauth-client-provider';
import type { McpAuthEventWithoutBase, OpenMcpHTTPClientConnectionOptions } from '~/main/mcp/types';
import * as models from '~/models';
import { TRANSPORT_TYPES } from '~/models/mcp-request';
import type { McpResponse } from '~/models/mcp-response';
import type { RequestHeader } from '~/models/request';
import { invariant } from '~/utils/invariant';

interface ResponseEventOptions {
  responseId: string;
  requestId: string;
  environmentId: string | null;
  timelinePath: string;
  eventLogPath: string;
  authProvider: McpOAuthClientProvider;
}

export const createStreamableHTTPTransport = async (
  options: OpenMcpHTTPClientConnectionOptions,
  {
    responseId,
    responseEnvironmentId,
    timelinePath,
    eventLogPath,
    authProvider,
  }: {
    responseId: string;
    responseEnvironmentId: string | null;
    timelinePath: string;
    eventLogPath: string;
    authProvider: McpOAuthClientProvider;
  },
) => {
  const { url, requestId } = options;
  if (!url) {
    throw new Error('MCP server url is required');
  }

  const reduceArrayToLowerCaseKeyedDictionary = (acc: Record<string, string>, { name, value }: RequestHeader) => ({
    ...acc,
    [name.toLowerCase() || '']: value || '',
  });
  const lowerCasedEnabledHeaders = options.headers
    .filter(({ name, disabled }) => Boolean(name) && !disabled)
    .reduce(reduceArrayToLowerCaseKeyedDictionary, {});

  const mcpServerUrl = new URL(url);
  const transport = new StreamableHTTPClientTransport(mcpServerUrl, {
    requestInit: {
      headers: lowerCasedEnabledHeaders,
    },
    fetch: (url, init) =>
      wrappedFetch(url, init || {}, {
        requestId,
        responseId,
        environmentId: responseEnvironmentId,
        timelinePath,
        eventLogPath,
        authProvider,
      }),
    reconnectionOptions: {
      maxReconnectionDelay: 30000,
      initialReconnectionDelay: 1000,
      reconnectionDelayGrowFactor: 1.5,
      maxRetries: 2,
    },
  });
  // transport.onmessage = message => _handleMcpMessage(message, requestId);
  return transport;
};

const parseResponseAndBuildTimeline = (requestHeaderLogs: string, response: Response) => {
  const statusMessage = response.statusText || '';
  const statusCode = response.status || 0;
  const responseHeaders: { name: string; value: string }[] = [...response.headers.entries()].map(([name, value]) => ({
    name,
    value,
  }));

  const headersIn = responseHeaders.map(({ name, value }) => `${name}: ${value}`).join('\n');
  const timeline = [
    { value: requestHeaderLogs, name: 'HeaderOut', timestamp: Date.now() },
    { value: `${statusCode} ${statusMessage}`, name: 'HeaderIn', timestamp: Date.now() },
    { value: headersIn, name: 'HeaderIn', timestamp: Date.now() },
  ];
  return { timeline, responseHeaders, statusCode, statusMessage };
};

// A wrapped fetch method for streamable http to log request and response detail
const wrappedFetch = async (
  url: string | URL,
  init: RequestInit,
  options: ResponseEventOptions,
  calledByAuth?: boolean,
) => {
  const { requestId, responseId, environmentId, timelinePath, eventLogPath, authProvider } = options;
  const { method = 'GET' } = init;

  const reqHeader = new Headers(init?.headers || {});
  const tokens = await authProvider.tokens();
  if (tokens) {
    // Keep the same header case as the mcp-ts-sdk: https://github.com/modelcontextprotocol/typescript-sdk/blob/1d475bb3f75674a46d81dba881ea743a763cbc12/src/client/streamableHttp.ts#L175-L178
    reqHeader.set('Authorization', `Bearer ${tokens.access_token}`);
    init.headers = reqHeader;
  }

  const isJsonRequest = reqHeader.get('content-type')?.toLowerCase().includes('application/json');
  const requestBody = isJsonRequest ? JSON.parse(init.body?.toString() || '{}') : init.body?.toString() || '';
  const isMcpInitializeRequest = isJsonRequest && isInitializeRequest(requestBody);
  if (isMcpInitializeRequest) {
    // Add initial timeline
    const initialTimelines = [
      { value: `Preparing request to ${url.toString()}`, name: 'Text', timestamp: Date.now() },
      { value: `Current time is ${new Date().toISOString()}`, name: 'Text', timestamp: Date.now() },
    ];
    initialTimelines.map(t => timelineFileStreams.get(requestId)?.write(JSON.stringify(t) + '\n'));
  }
  const requestHeaders: { name: string; value: string }[] = [...reqHeader.entries()].map(([name, value]) => ({
    name,
    value,
  }));
  const requestMethodLine = `${method.toUpperCase()} ${url} ${isJsonRequest && requestBody?.method ? `\nJSON-RPC Method: ${requestBody.method}` : ''}`;
  const headersOut = requestHeaders.map(({ name, value }) => `${name}: ${value}`).join('\n');
  const start = performance.now();
  const response = await fetch(url, init);
  const { timeline, responseHeaders, statusCode, statusMessage } = parseResponseAndBuildTimeline(
    `${requestMethodLine}\n${headersOut}`,
    response,
  );
  timeline.map(t => timelineFileStreams.get(requestId)?.write(JSON.stringify(t) + '\n'));

  if (isMcpInitializeRequest) {
    // Create response model only for initialize response
    const responsePatch: Partial<McpResponse> = {
      _id: responseId,
      parentId: requestId,
      environmentId,
      headers: responseHeaders,
      url: url.toString(),
      statusCode,
      statusMessage,
      elapsedTime: performance.now() - start,
      timelinePath,
      eventLogPath,
      transportType: TRANSPORT_TYPES.HTTP,
    };
    const settings = await models.settings.get();
    const res = await models.mcpResponse.updateOrCreate(responsePatch, settings.maxHistoryResponses);
    models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: res._id });
  }

  // Avoid infinite loop, only call auth flow once per request
  // DELETE method is used to terminate the MCP request, it should not trigger auth flow to keep consistent with the SDK behavior.
  // See: https://github.com/modelcontextprotocol/typescript-sdk/blob/058b87c163996b31d5cda744085ecf3c13c5c56a/src/client/streamableHttp.ts#L529-L537
  if (!calledByAuth && statusCode === 401 && method !== 'DELETE') {
    const mcpRequest = await models.mcpRequest.getById(requestId);
    invariant(mcpRequest, 'MCP Request not found');
    const { authentication } = mcpRequest;
    // By default no authentication is set, authentication is an empty object. Proceed to oauth workflow.
    const isDefaultAuth = !('type' in authentication);
    // Continue to oauth workflow only when the auth type is mcp oauth and enable it.
    if (!isDefaultAuth) {
      const isMcpOauth2AuthType = authentication.type === 'oauth2' && authentication.grantType === 'mcp_auth_flow';
      const isAuthTypeEnabled = !authentication.disabled;
      if (!(isMcpOauth2AuthType && isAuthTypeEnabled)) {
        return response;
      }
    }

    const resourceMetadataUrl = extractResourceMetadataUrl(response);
    if (resourceMetadataUrl) {
      authProvider.saveResourceMetadataUrl(resourceMetadataUrl);
    }

    const authEvent: McpAuthEventWithoutBase = {
      type: 'message',
      method: 'MCP Auth',
      direction: 'INCOMING',
      data: {
        statusCode,
        statusMessage,
        resourceMetadataUrl: resourceMetadataUrl?.toString() || null,
      },
    };
    writeEventLogAndNotify(requestId, authEvent);

    let authResult: AuthResult;

    let authPromiseResolve: (authorizationCode: string) => void = () => {};
    const redirectPromise = new Promise<string>(res => (authPromiseResolve = res));
    const unsubscribe = authProvider.onRedirectEnd(async (authorizationCode: string) => {
      // Resolve the promise to continue the auth flow after user has completed authorization in default browser
      authPromiseResolve(authorizationCode);
    });

    const authFetchFn = async (url: string | URL, init?: RequestInit) => {
      const authRequestEvent: McpAuthEventWithoutBase = {
        type: 'message',
        method: 'MCP Auth',
        direction: 'OUTGOING',
        data: {
          url: typeof url === 'string' ? url : url.toString(),
          method: init?.method || 'GET',
          headers: init?.headers || {},
          body: init?.body || null,
        },
      };
      writeEventLogAndNotify(requestId, authRequestEvent);
      const response = await fetch(url, init);

      const authResponseEvent: McpAuthEventWithoutBase = {
        type: 'message',
        method: 'MCP Auth',
        direction: 'INCOMING',
        data: {
          statusCode: response.status,
          statusMessage: response.statusText,
          body: await response.clone().text(),
        },
      };
      writeEventLogAndNotify(requestId, authResponseEvent);

      return response;
    };

    try {
      // Start auth flow
      // Discovery authorization server and dynamic register client if supported
      // Refer https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization#authorization-server-discovery
      authResult = await auth(authProvider, {
        serverUrl: url,
        resourceMetadataUrl,
        fetchFn: authFetchFn,
      });
      // Wait for user to complete authorization in default browser and get authorization code
      if (authResult === 'REDIRECT') {
        // Wait for oauth authorization flow to complete in default browser
        const authorizationCode = await redirectPromise;
        // Exchange authorization code for tokens
        authResult = await auth(authProvider, {
          serverUrl: url,
          resourceMetadataUrl,
          authorizationCode,
          fetchFn: authFetchFn,
        });
      }
      // Close the oauth authorization modal after authorization is complete
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('hide-oauth-authorization-modal');
      });
      if (authResult !== 'AUTHORIZED') {
        throw new UnauthorizedError();
      }
      return await wrappedFetch(url, init, options, calledByAuth);
    } finally {
      unsubscribe();
    }
  }
  return response;
};
