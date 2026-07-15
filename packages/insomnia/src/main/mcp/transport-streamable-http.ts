import {
  auth,
  type AuthResult,
  extractWWWAuthenticateParams,
  UnauthorizedError,
} from '@modelcontextprotocol/sdk/client/auth.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { BrowserWindow } from 'electron';
import type { McpResponse, RequestHeader } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import type { Dispatcher } from 'undici';

import { type ConnectionContext, getFetchDispatcher, writeEventLogAndNotify, writeTimeline } from '~/main/mcp/common';
import { MCPAuthError, type McpOAuthClientProvider } from '~/main/mcp/oauth-client-provider';
import type { McpAuthEventWithoutBase, OpenMcpHTTPClientConnectionOptions } from '~/main/mcp/types';

// Extend undici RequestInit to include dispatcher, it's in node.js fetch but not in dom fetch.
interface NodeRequestInit extends RequestInit {
  dispatcher?: Dispatcher;
}

export const createStreamableHTTPTransport = async (
  context: ConnectionContext,
  options: OpenMcpHTTPClientConnectionOptions,
  authProvider: McpOAuthClientProvider,
) => {
  const { url, headers } = options;
  if (!url) {
    throw new Error('MCP server url is required');
  }

  const reduceArrayToLowerCaseKeyedDictionary = (acc: Record<string, string>, { name, value }: RequestHeader) => ({
    ...acc,
    [name.toLowerCase() || '']: value || '',
  });
  const lowerCasedEnabledHeaders = headers
    .filter(({ name, disabled }) => Boolean(name) && !disabled)
    .reduce(reduceArrayToLowerCaseKeyedDictionary, {});

  const mcpServerUrl = new URL(url);
  const transport = new StreamableHTTPClientTransport(mcpServerUrl, {
    requestInit: {
      headers: lowerCasedEnabledHeaders,
    },
    fetch: (url, init) => wrappedFetch(url, init || {}, context, authProvider),
    reconnectionOptions: {
      maxReconnectionDelay: 30_000,
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
  context: ConnectionContext,
  authProvider: McpOAuthClientProvider,
  calledByAuth?: boolean,
) => {
  const { requestId, responseId, environmentId, timelinePath, eventLogPath, options } = context;
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
    initialTimelines.map(t => writeTimeline(context, JSON.stringify(t)));
  }
  const requestHeaders: { name: string; value: string }[] = [...reqHeader.entries()].map(([name, value]) => ({
    name,
    value,
  }));
  const requestMethodLine = `${method.toUpperCase()} ${url} ${isJsonRequest && requestBody?.method ? `\nJSON-RPC Method: ${requestBody.method}` : ''}`;
  const headersOut = requestHeaders.map(({ name, value }) => `${name}: ${value}`).join('\n');
  const start = performance.now();
  const response = await fetch(url, {
    ...init,
    dispatcher: await getFetchDispatcher(requestId),
  } as NodeRequestInit);
  const { timeline, responseHeaders, statusCode, statusMessage } = parseResponseAndBuildTimeline(
    `${requestMethodLine}\n${headersOut}`,
    response,
  );
  timeline.map(t => writeTimeline(context, JSON.stringify(t)));

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
      transportType: models.mcpRequest.TRANSPORT_TYPES.HTTP,
    };
    const settings = await services.settings.get();
    const res = await services.mcpResponse.updateOrCreate(responsePatch, settings.maxHistoryResponses);
    services.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: res._id });
  }

  // Avoid infinite loop, only call auth flow once per request
  // DELETE method is used to terminate the MCP request, it should not trigger auth flow to keep consistent with the SDK behavior.
  // See: https://github.com/modelcontextprotocol/typescript-sdk/blob/058b87c163996b31d5cda744085ecf3c13c5c56a/src/client/streamableHttp.ts#L529-L537
  if (!calledByAuth && statusCode === 401 && method !== 'DELETE') {
    const { authentication } = options as OpenMcpHTTPClientConnectionOptions;
    // use authentication from connection options rather than from db directly to get rendered values
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

    const { resourceMetadataUrl, scope: scopeFromWWWAuthenticate } = extractWWWAuthenticateParams(response);
    // Use scope from authenticate config if available, otherwise use scope from WWW-Authenticate header
    const scope =
      'scope' in authentication && authentication.scope && authentication.scope.trim().length > 0
        ? authentication.scope
        : scopeFromWWWAuthenticate;
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
    writeEventLogAndNotify(context, authEvent);

    let authResult: AuthResult;

    let authPromiseResolve: (authorizationCode: string) => void = () => {};
    const redirectPromise = new Promise<string>(res => (authPromiseResolve = res));
    const unsubscribe = authProvider.onRedirectEnd(async (authorizationCode: string) => {
      // Resolve the promise to continue the auth flow after user has completed authorization in default browser
      // Will be triggered when `redirectToAuthorization` completes in the oauth client provider
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
      writeEventLogAndNotify(context, authRequestEvent);
      try {
        const response = await fetch(url, {
          ...init,
          dispatcher: await getFetchDispatcher(requestId),
        } as NodeRequestInit);

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
        writeEventLogAndNotify(context, authResponseEvent);

        return response;
      } catch (error) {
        const authErrorEvent: McpAuthEventWithoutBase = {
          type: 'message',
          method: 'MCP Auth',
          direction: 'INCOMING',
          data: {
            statusCode: null,
            statusMessage: 'Fetch failed',
            message: error?.message || String(error),
            ...(error.cause ? { cause: error.cause.message || String(error.cause) } : {}),
          },
        };
        writeEventLogAndNotify(context, authErrorEvent);
        throw error;
      }
    };

    try {
      // Start auth flow
      // Discovery authorization server and dynamic register client if supported
      // Refer https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization#authorization-server-discovery
      authResult = await auth(authProvider, {
        serverUrl: url,
        resourceMetadataUrl,
        fetchFn: authFetchFn,
        scope,
      });
      // Wait for user to complete authorization in default browser and get authorization code
      if (authResult === 'REDIRECT') {
        // Wait for oauth authorization flow to complete in default browser
        const authorizationCode = await redirectPromise;
        // Exchange authorization code for tokens
        authResult = await auth(authProvider, {
          serverUrl: url,
          resourceMetadataUrl,
          scope,
          authorizationCode,
          fetchFn: authFetchFn,
        });
      }
      if (authResult !== 'AUTHORIZED') {
        throw new UnauthorizedError();
      }
    } catch (e) {
      console.error('Authentication failed', e);
      // Wrap and throw MCPAuthError for better identification, some of the errors thrown by sdk are generic Error which is hard to identify
      throw new MCPAuthError(e.message || 'Authentication failed', { cause: e });
    } finally {
      // Close the oauth authorization modal after authorization is complete
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('hide-oauth-authorization-modal');
      });
      // cleanup the oauth client provider listener
      unsubscribe();
    }
    return await wrappedFetch(url, init, context, authProvider, true);
  }
  return response;
};
