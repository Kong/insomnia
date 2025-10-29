import fs from 'node:fs';
import path from 'node:path';

import {
  auth,
  type AuthResult,
  extractResourceMetadataUrl,
  type OAuthClientProvider,
  UnauthorizedError,
} from '@modelcontextprotocol/sdk/client/auth.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  type OAuthClientInformationFull,
  OAuthClientInformationSchema,
  type OAuthClientMetadata,
  type OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type {
  CallToolRequest,
  GetPromptRequest,
  Notification,
  ReadResourceRequest,
} from '@modelcontextprotocol/sdk/types.js';
import {
  type ClientRequest,
  CompatibilityCallToolResultSchema,
  ElicitResultSchema,
  EmptyResultSchema,
  InitializeRequestSchema,
  isInitializeRequest,
  JSONRPCErrorSchema,
  type JSONRPCMessage,
  type JSONRPCRequest,
  type JSONRPCResponse,
  type ListPromptsRequest,
  type ListResourcesRequest,
  ListRootsRequestSchema,
  ListRootsResultSchema,
  ServerNotificationSchema,
  type SubscribeRequest,
  type UnsubscribeRequest,
} from '@modelcontextprotocol/sdk/types.js';
import electron, { BrowserWindow, ipcMain } from 'electron';
import { shellPath } from 'shell-path';
import { parse } from 'shell-quote';
import { v4 as uuidV4 } from 'uuid';
import type { z } from 'zod';

import { getAppVersion, getOauthRedirectUrl, getProductName, REALTIME_EVENTS_CHANNELS } from '~/common/constants';
import {
  getMcpMethodFromMessage,
  METHOD_ELICITATION_CREATE_MESSAGE,
  METHOD_LIST_ROOTS,
  METHOD_SUBSCRIBE_RESOURCE,
  METHOD_UNKNOWN,
  METHOD_UNSUBSCRIBE_RESOURCE,
} from '~/common/mcp-utils';
import { generateId } from '~/common/misc';
import { SegmentEvent, trackSegmentEvent } from '~/main/analytics';
import { authorizeUserInDefaultBrowser } from '~/main/authorizeUserInDefaultBrowser';
import * as models from '~/models';
import { type McpRequest, TRANSPORT_TYPES, type TransportType } from '~/models/mcp-request';
import { type McpResponse, prefix as mcpResponsePrefix } from '~/models/mcp-response';
import type { RequestAuthentication, RequestHeader } from '~/models/request';
import { encryptOAuthUrl } from '~/network/o-auth-2/utils';
import { invariant } from '~/utils/invariant';

import { ipcMainHandle, ipcMainOn } from '../ipc/electron';

// Refer the SDK: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/src/shared/protocol.ts#L504
// The Client type has missing transport property
type McpClient = Client & { transport: StreamableHTTPClientTransport | StdioClientTransport };
// Mcp connection and request options
interface CommonMcpOptions {
  requestId: string;
}
type OpenMcpHTTPClientConnectionOptions = CommonMcpOptions & {
  workspaceId: string;
  url: string;
  transportType: typeof TRANSPORT_TYPES.HTTP;
  headers: RequestHeader[];
  authentication: RequestAuthentication;
};
type OpenMcpStdioClientConnectionOptions = CommonMcpOptions & {
  workspaceId: string;
  // TODO: should rename to command or urlOrCommand
  url: string;
  transportType: typeof TRANSPORT_TYPES.STDIO;
  env: Record<string, string>;
};
export type OpenMcpClientConnectionOptions = OpenMcpHTTPClientConnectionOptions | OpenMcpStdioClientConnectionOptions;
const isOpenMcpHTTPClientConnectionOptions = (
  options: OpenMcpClientConnectionOptions,
): options is OpenMcpHTTPClientConnectionOptions => {
  return options.transportType === TRANSPORT_TYPES.HTTP;
};
export interface McpRequestOptions {
  requestId: string;
  request: ClientRequest;
  schema: z.ZodType;
  signal?: AbortSignal;
}
interface McpEventBase {
  _id: string;
  requestId: string;
  timestamp: number;
}
interface McpCloseEventWithoutBase {
  type: 'close';
  reason: string;
}
interface McpMessageEventWithoutBase {
  type: 'message';
  direction: 'INCOMING';
  data: JSONRPCResponse | {};
  method: string;
}
export type McpMessageEvent = McpEventBase & McpMessageEventWithoutBase;
interface McpErrorEventWithoutBase {
  type: 'error';
  message: string;
  error: any;
}
interface McpRequestEventWithoutBase {
  type: 'message';
  direction: 'OUTGOING';
  method: string;
  data: any;
}
interface McpNotificationEventWithoutBase {
  type: 'notification';
  method: string;
  direction: 'INCOMING';
  data: Notification;
}
interface McpAuthEventWithoutBase {
  type: 'message';
  method: 'MCP Auth';
  direction: 'OUTGOING' | 'INCOMING';
  data: Record<string, any>;
}
export type McpNotificationEvent = McpEventBase & McpNotificationEventWithoutBase;
type McpEventWithoutBase =
  | McpMessageEventWithoutBase
  | McpRequestEventWithoutBase
  | McpCloseEventWithoutBase
  | McpErrorEventWithoutBase
  | McpNotificationEventWithoutBase
  | McpAuthEventWithoutBase;
export type McpEvent = McpEventBase & McpEventWithoutBase;
interface ResponseEventOptions {
  responseId: string;
  requestId: string;
  environmentId: string | null;
  timelinePath: string;
  eventLogPath: string;
  authProvider: McpOAuthClientProvider;
}

const mcpConnections = new Map<string, McpClient>();
const eventLogFileStreams = new Map<string, fs.WriteStream>();
const timelineFileStreams = new Map<string, fs.WriteStream>();
const requestIdToResponseIdMap = new Map<string, string>();

const protocol = 'mcp';
const getMcpStateChannel = (requestId: string) => `${protocol}.${requestId}.${REALTIME_EVENTS_CHANNELS.READY_STATE}`;
const mcpEventIdGenerator = () => `mcp-${uuidV4()}`;

const writeEventLogAndNotify = (
  requestId: string,
  data: McpEventWithoutBase,
  {
    clearRequestIdMap = false,
    newLine = true,
  }: {
    clearRequestIdMap?: boolean;
    newLine?: boolean;
  } = {},
) => {
  const eventData: McpEvent = {
    ...data,
    _id: mcpEventIdGenerator(),
    requestId,
    timestamp: Date.now(),
  };
  const stringifiedData = JSON.stringify(eventData);
  const dataToWrite = newLine ? stringifiedData + '\n' : stringifiedData;
  eventLogFileStreams.get(requestId)?.write(dataToWrite, () => {
    // notify all renderers of new event has been received
    for (const window of BrowserWindow.getAllWindows()) {
      const resId = requestIdToResponseIdMap.get(requestId);
      if (resId) {
        const notifyChannel = `${protocol}.${resId}.${REALTIME_EVENTS_CHANNELS.NEW_EVENT}`;
        notifyChannel && window.webContents.send(notifyChannel);
        if (clearRequestIdMap) {
          // clean up maps after last event has been written to file
          requestIdToResponseIdMap.delete(requestId);
        }
      }
    }
  });
};

const _getMcpClient = (id: string) => {
  const mcpClient = mcpConnections.get(id);
  invariant(
    mcpClient,
    `No existing MCP client connection found for requestId: ${id}. It might have been disconnected.`,
  );
  return mcpClient;
};

const _notifyMcpClientStateChange = (channel: string, isConnected: boolean) => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, isConnected);
  }
};

const _clearMcpMaps = (requestId: string, timelineMessage: string, event?: McpEventWithoutBase) => {
  if (event) {
    writeEventLogAndNotify(requestId, event, {
      clearRequestIdMap: true,
    });
  }
  eventLogFileStreams.get(requestId)?.end();
  eventLogFileStreams.delete(requestId);
  timelineFileStreams
    .get(requestId)
    ?.write(JSON.stringify({ value: timelineMessage, name: 'Text', timestamp: Date.now() }) + '\n');
  timelineFileStreams.get(requestId)?.end();
  timelineFileStreams.delete(requestId);
  mcpConnections.delete(requestId);
};

const _handleCloseMcpConnection = (requestId: string) => {
  const closeEvent: McpCloseEventWithoutBase = {
    type: 'close',
    reason: 'Mcp connection closed',
  };
  // clear in-memory store
  _clearMcpMaps(requestId, 'Closed MCP connection', closeEvent);

  const mcpStateChannel = getMcpStateChannel(requestId);
  // notify renderer process about state change
  _notifyMcpClientStateChange(mcpStateChannel, false);
};

const _handleMcpClientError = (requestId: string, error: Error, prefix?: string) => {
  const messageEvent: McpErrorEventWithoutBase = {
    type: 'error',
    message: prefix || 'Unknown error',
    error: error.message,
  };
  writeEventLogAndNotify(requestId, messageEvent);
  console.error(`MCP client error for ${requestId}`, error);
};

const _handleMcpMessage = (message: JSONRPCMessage, requestId: string) => {
  let messageEvent: McpMessageEventWithoutBase | McpErrorEventWithoutBase | McpNotificationEventWithoutBase;
  if (JSONRPCErrorSchema.safeParse(message).success) {
    // Error message
    const errorDetail = JSONRPCErrorSchema.parse(message).error;
    let errorMessage = errorDetail.message;
    try {
      // Try to parse error message to JSON if possible
      errorMessage = JSON.parse(errorMessage);
    } catch (error) {}

    messageEvent = {
      type: 'error',
      error: errorMessage,
      message: `MCP Error ${errorDetail.code}`,
    };
  } else if (ServerNotificationSchema.safeParse(message).success) {
    // Server notification message
    messageEvent = {
      type: 'notification',
      direction: 'INCOMING',
      method: getMcpMethodFromMessage(message),
      data: ServerNotificationSchema.parse(message),
    };
  } else {
    if ('result' in message && EmptyResultSchema.safeParse(message.result).success) {
      console.info('Ignoring empty result message');
      // ignore empty result message
      return;
    }
    const method = getMcpMethodFromMessage(message);
    messageEvent = {
      type: 'message',
      method,
      data: message as JSONRPCResponse,
      direction: 'INCOMING',
    };
  }
  writeEventLogAndNotify(requestId, messageEvent);
};

const parseAndLogMcpRequest = (requestId: string, message: any) => {
  if (message) {
    // Add request event
    let requestMethod = message?.method;
    if (!requestMethod) {
      if (ListRootsResultSchema.safeParse(message?.result).success) {
        requestMethod = METHOD_LIST_ROOTS;
      } else if (ElicitResultSchema.safeParse(message?.result).success) {
        requestMethod = METHOD_ELICITATION_CREATE_MESSAGE;
      } else if (JSONRPCErrorSchema.safeParse(message).success) {
        requestMethod = 'JSON-RPC Error';
      } else {
        requestMethod = METHOD_UNKNOWN;
      }
    }
    const requestEvent: McpRequestEventWithoutBase = {
      method: requestMethod,
      type: 'message',
      direction: 'OUTGOING',
      data: message,
    };
    writeEventLogAndNotify(requestId, requestEvent);
  }
};

const createErrorResponse = async ({
  requestId,
  responseId,
  environmentId,
  timelinePath,
  message,
  transportType,
}: Omit<ResponseEventOptions, 'authProvider'> & { message: string; transportType: TransportType }) => {
  const settings = await models.settings.get();
  const responsePatch = {
    _id: responseId,
    parentId: requestId,
    environmentId: environmentId,
    timelinePath,
    status: 'danger',
    statusMessage: 'Error',
    error: message,
    transportType,
  };

  const res = await models.mcpResponse.updateOrCreate(responsePatch, settings.maxHistoryResponses);
  models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: res._id });
};

const getInitialTimeline = (url: string) => {
  return [
    { value: `Preparing request to ${url}`, name: 'Text', timestamp: Date.now() },
    { value: `Current time is ${new Date().toISOString()}`, name: 'Text', timestamp: Date.now() },
  ];
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

// A wrapped fetch to log request and response details
const fetchWithLogging = async (
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
    const initialTimelines = getInitialTimeline(url.toString());
    initialTimelines.map(t => timelineFileStreams.get(requestId)?.write(JSON.stringify(t) + '\n'));
  }
  const requestHeaders: { name: string; value: string }[] = [...reqHeader.entries()].map(([name, value]) => ({
    name,
    value,
  }));
  const requestMethodLine = `${method.toUpperCase()} ${url} ${isJsonRequest && requestBody?.method ? `\nJSON-RPC Method: ${requestBody.method}` : ''}`;
  const headersOut = requestHeaders.map(({ name, value }) => `${name}: ${value}`).join('\n');
  // Log outgoing request
  parseAndLogMcpRequest(requestId, requestBody);

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
      authResult = await auth(authProvider, {
        serverUrl: url,
        resourceMetadataUrl,
        fetchFn: authFetchFn,
      });
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
      if (authResult !== 'AUTHORIZED') {
        throw new UnauthorizedError();
      }
      return await fetchWithLogging(url, init, options, calledByAuth);
    } finally {
      unsubscribe();
    }
  }

  return response;
};

class McpOAuthClientProvider implements OAuthClientProvider {
  private _codeVerifier?: string;
  private _resourceMetadataUrl?: URL;
  private _redirectEndListener: ((authorizationCode: string) => void) | null = null;
  constructor(private mcpRequest: McpRequest) {}
  get redirectUrl() {
    return getOauthRedirectUrl();
  }
  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_name: 'Insomnia MCP Client',
      client_uri: 'https://github.com/Kong/insomnia',
      scope: 'scope' in this.mcpRequest.authentication ? this.mcpRequest.authentication.scope : undefined,
    };
  }
  private async refreshMcpRequest() {
    const _mcpRequest = await models.mcpRequest.getById(this.mcpRequest._id);
    invariant(_mcpRequest, 'MCP Request not found');
    this.mcpRequest = _mcpRequest;
  }
  private isUsingMcpAuthFlow() {
    const { authentication } = this.mcpRequest;
    return 'grantType' in authentication && authentication.grantType === 'mcp_auth_flow' && !authentication.disabled;
  }
  private async updateAuthentication(auth: Partial<RequestAuthentication>) {
    await models.mcpRequest.update(this.mcpRequest, {
      authentication: {
        ...this.mcpRequest.authentication,
        ...auth,
      },
    });
    await this.refreshMcpRequest();
  }
  // It's called when auth tries to get client information for authorization, use as a starting point for MCP Auth Flow
  // See: https://github.com/modelcontextprotocol/typescript-sdk/blob/1d475bb3f75674a46d81dba881ea743a763cbc12/src/client/auth.ts#L349
  async clientInformation() {
    // If not using MCP Auth Flow, wait for user to confirm in the app UI
    if (!this.isUsingMcpAuthFlow()) {
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('mcp-auth-confirmation');
      });
      await new Promise<void>((resolve, reject) => {
        ipcMain.once('mcp.authConfirmed', async (_, confirmed: boolean) => {
          if (!confirmed) {
            reject(new Error('MCP authorization cancelled by user'));
          } else {
            await this.updateAuthentication({
              type: 'oauth2',
              grantType: 'mcp_auth_flow',
              disabled: false,
            });
            resolve();
          }
        });
      });
    }

    if ('clientId' in this.mcpRequest.authentication && this.mcpRequest.authentication.clientId) {
      return {
        client_id: this.mcpRequest.authentication.clientId,
        client_secret: this.mcpRequest.authentication.clientSecret,
        client_id_issued_at: this.mcpRequest.authentication.clientIdIssuedAt,
        client_secret_expires_at: this.mcpRequest.authentication.clientSecretExpiresAt,
      };
    }
    return undefined;
  }
  async saveClientInformation(clientInformation: OAuthClientInformationFull) {
    const parsedClientInformation = OAuthClientInformationSchema.parse(clientInformation);
    await models.mcpRequest.update(this.mcpRequest, {
      authentication: {
        ...this.mcpRequest.authentication,
        clientId: parsedClientInformation.client_id,
        clientSecret: parsedClientInformation.client_secret,
        clientIdIssuedAt: parsedClientInformation.client_id_issued_at,
        clientSecretExpiresAt: parsedClientInformation.client_secret_expires_at,
      },
    });
    await this.refreshMcpRequest();
  }
  async tokens(): Promise<OAuthTokens | undefined> {
    const { authentication } = this.mcpRequest;
    // Don't return tokens if not using MCP Auth Flow or if disabled
    if (this.isUsingMcpAuthFlow()) {
      const token = await models.oAuth2Token.getOrCreateByParentId(this.mcpRequest._id);
      if (token.accessToken) {
        return {
          access_token: token.accessToken,
          refresh_token: token.refreshToken,
          id_token: token.identityToken,
          expires_in: token.expiresAt ? Math.floor(token.expiresAt / 1000) : undefined,
          token_type: ('tokenPrefix' in authentication && authentication.tokenPrefix) || 'Bearer',
        };
      }
    }
    return undefined;
  }
  async saveTokens(tokens: OAuthTokens) {
    const token = await models.oAuth2Token.getOrCreateByParentId(this.mcpRequest._id);
    await models.oAuth2Token.update(token, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      identityToken: tokens.id_token || '',
      expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
    });
    await models.mcpRequest.update(this.mcpRequest, {
      authentication: {
        ...this.mcpRequest.authentication,
        scope: tokens.scope,
        tokenPrefix: tokens.token_type,
      },
    });
    await this.refreshMcpRequest();
  }
  saveResourceMetadataUrl(url: URL | undefined) {
    this._resourceMetadataUrl = url;
  }
  get resourceMetadataUrl() {
    return this._resourceMetadataUrl;
  }
  async redirectToAuthorization(authorizationUrl: URL) {
    const { relayUrl, decryptOAuthResult } = encryptOAuthUrl(authorizationUrl.toString());
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('show-oauth-authorization-modal', relayUrl);
    });
    const redirectedResult = await authorizeUserInDefaultBrowser({
      url: relayUrl,
    });
    const redirectedTo = decryptOAuthResult(redirectedResult);
    const redirectParams = Object.fromEntries(new URL(redirectedTo).searchParams);
    const authorizationCode = redirectParams.code;
    if (!authorizationCode) {
      throw new Error('Authorization code not found');
    }
    await this._redirectEndListener?.(authorizationCode);
  }
  onRedirectEnd(listener: (authorizationCode: string) => void) {
    this._redirectEndListener = listener;
    return () => {
      this._redirectEndListener = null;
    };
  }
  async saveCodeVerifier(codeVerifier: string) {
    this._codeVerifier = codeVerifier;
  }
  async codeVerifier() {
    if (!this._codeVerifier) {
      throw new Error('Code verifier not set');
    }
    return this._codeVerifier;
  }
}

const createStreamableHTTPTransport = async (
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
      fetchWithLogging(url, init || {}, {
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
  transport.onmessage = message => _handleMcpMessage(message, requestId);
  return transport;
};

const createStdioTransport = async (
  options: OpenMcpStdioClientConnectionOptions,
  {
    responseId,
    responseEnvironmentId,
    timelinePath,
    eventLogPath,
  }: {
    responseId: string;
    responseEnvironmentId: string | null;
    timelinePath: string;
    eventLogPath: string;
  },
) => {
  const { url, requestId, env } = options;
  if (!url) {
    throw new Error('Command is required for STDIO transport');
  }
  const parseResult = parse(url);
  if (parseResult.find(arg => typeof arg !== 'string')) {
    throw new Error('Invalid command format');
  }
  const [command, ...args] = parseResult as string[];

  const initialTimelines = getInitialTimeline(`STDIO: ${url}`);
  // Add stdio-specific timeline info
  initialTimelines.push({
    value: `Run command: ${url}`,
    name: 'HeaderOut',
    timestamp: Date.now(),
  });
  const pathEnv = (await shellPath()) || process.env.PATH || '';
  // Filter out empty keys from env
  const filteredEnv = Object.fromEntries(Object.entries(env).filter(([key]) => key.trim().length));
  const finalEnv = {
    PATH: pathEnv,
    ...filteredEnv,
  };
  const stringifiedEnv = Object.entries(finalEnv)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')
    .trim();
  if (stringifiedEnv) {
    initialTimelines.push({
      value: `With env: ${stringifiedEnv}`,
      name: 'HeaderOut',
      timestamp: Date.now(),
    });
  }
  initialTimelines.map(t => timelineFileStreams.get(requestId)?.write(JSON.stringify(t) + '\n'));

  const start = performance.now();
  const transport = new StdioClientTransport({
    command,
    args,
    env: finalEnv,
    stderr: 'pipe',
  });

  // Capture stderr logs for debugging
  const stderrStream = transport.stderr;
  stderrStream?.on('data', (chunk: Buffer) => {
    const stderrData = chunk.toString().trim();
    if (!stderrData) return; // Skip empty lines

    // Log stderr output to timeline with appropriate categorization
    timelineFileStreams.get(requestId)?.write(
      JSON.stringify({
        value: stderrData,
        name: 'HeaderIn',
        timestamp: Date.now(),
      }) + '\n',
    );
  });

  // Wrap the original send method to log outgoing requests for stdio transport
  const originalSend = transport.send.bind(transport);
  transport.send = async (message: JSONRPCRequest) => {
    const isInitializedMessage = InitializeRequestSchema.safeParse(message).success;
    // Create response model for initialize message and add process status timeline
    if (isInitializedMessage) {
      // Add process started timeline (similar to HTTP response timeline)
      timelineFileStreams
        .get(requestId)
        ?.write(JSON.stringify({ value: 'Process started and ready', name: 'Text', timestamp: Date.now() }) + '\n');

      const responsePatch: Partial<McpResponse> = {
        _id: responseId,
        parentId: requestId,
        environmentId: responseEnvironmentId,
        url,
        status: 'success',
        elapsedTime: performance.now() - start,
        timelinePath,
        eventLogPath,
        transportType: TRANSPORT_TYPES.STDIO,
      };
      const settings = await models.settings.get();
      const res = await models.mcpResponse.updateOrCreate(responsePatch, settings.maxHistoryResponses);
      models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: res._id });
    }
    // Log outgoing request
    parseAndLogMcpRequest(requestId, message);

    return originalSend(message);
  };

  transport.onmessage = message => _handleMcpMessage(message, requestId);
  return transport;
};

const createTransportAndConnect = async (
  mcpClient: Client,
  connectionOptions: OpenMcpClientConnectionOptions,
  options: {
    responseId: string;
    responseEnvironmentId: string | null;
    timelinePath: string;
    eventLogPath: string;
  },
) => {
  if (!isOpenMcpHTTPClientConnectionOptions(connectionOptions)) {
    const transport = await createStdioTransport(connectionOptions, options);
    await mcpClient.connect(transport);
  } else {
    const mcpRequest = await models.mcpRequest.getById(connectionOptions.requestId);
    invariant(mcpRequest, 'MCP Request not found');

    const authProvider = new McpOAuthClientProvider(mcpRequest);
    const transport = await createStreamableHTTPTransport(connectionOptions, {
      ...options,
      authProvider,
    });
    // Use a longer timeout for initial connection to allow for auth flow to complete
    await mcpClient.connect(transport, { timeout: 3 * 60 * 1000 });
  }
  const mcpRequest = await models.mcpRequest.getById(connectionOptions.requestId);
  invariant(mcpRequest, 'MCP Request not found');

  let authType = 'none';
  if ('type' in mcpRequest.authentication) {
    if (mcpRequest.authentication.type === 'oauth2') {
      authType = 'oauth2-' + mcpRequest.authentication.grantType;
    } else {
      authType = mcpRequest.authentication.type;
    }
  }
  const authDisabled = 'disabled' in mcpRequest.authentication && mcpRequest.authentication.disabled;
  const isFirstConnection = !mcpRequest.connected;
  trackSegmentEvent(SegmentEvent.mcpClientConnected, {
    transportType: connectionOptions.transportType,
    firstTime: isFirstConnection,
    ...(connectionOptions.transportType === TRANSPORT_TYPES.HTTP
      ? {
          authType,
          authDisabled,
        }
      : {}),
  });
  if (isFirstConnection) {
    // Mark as connected for the first time
    await models.mcpRequest.update(mcpRequest, { connected: true });
  }
};

const openMcpClientConnection = async (options: OpenMcpClientConnectionOptions) => {
  const { requestId, workspaceId } = options;

  // create response model and file streams
  const responseId = generateId(mcpResponsePrefix);
  const responsesDir = path.join(process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData'), 'responses');
  const eventLogPath = path.join(responsesDir, uuidV4() + '.response');
  eventLogFileStreams.set(requestId, fs.createWriteStream(eventLogPath));
  const timelinePath = path.join(responsesDir, responseId + '.timeline');
  timelineFileStreams.set(requestId, fs.createWriteStream(timelinePath));
  requestIdToResponseIdMap.set(options.requestId, responseId);

  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);
  // fallback to base environment
  const activeEnvironmentId = workspaceMeta.activeEnvironmentId;
  const activeEnvironment = activeEnvironmentId && (await models.environment.getById(activeEnvironmentId));
  const environment = activeEnvironment || (await models.environment.getOrCreateForParentId(workspaceId));
  invariant(environment, 'failed to find environment ' + activeEnvironmentId);
  const responseEnvironmentId = environment ? environment._id : null;

  // create MCP paylod model if not exists
  await models.mcpPayload.getOrCreateByParentIdAndUrl(requestId, options.url);

  // create connection
  const mcpClient = new Client(
    {
      name: getProductName(),
      version: getAppVersion(),
    },
    {
      capabilities: {
        roots: {
          // declare the client to support list roots
          listChanged: true,
        },
      },
    },
  );
  mcpClient.onerror = _error => _handleMcpClientError(requestId, _error, 'MCP Client Error');
  const mcpStateChannel = getMcpStateChannel(requestId);

  try {
    await createTransportAndConnect(mcpClient, options, {
      responseId,
      responseEnvironmentId,
      timelinePath,
      eventLogPath,
    });
    mcpClient.onclose = () => _handleCloseMcpConnection(requestId);
  } catch (error) {
    // Log error when connection fails with exception
    createErrorResponse({
      requestId,
      responseId,
      environmentId: responseEnvironmentId,
      timelinePath,
      eventLogPath,
      message: error.message || 'Something went wrong',
      transportType: options.transportType,
    });
    console.error(`Failed to create ${options.transportType} transport: ${error}`);
    _handleCloseMcpConnection(requestId);
    return;
  }
  // Support listing roots
  mcpClient.setRequestHandler(ListRootsRequestSchema, async () => {
    const mcpRequest = await models.mcpRequest.getById(requestId);
    invariant(mcpRequest, 'MCP request not found');
    return { roots: mcpRequest.roots };
  });

  if (mcpConnections.has(requestId)) {
    // close existing connection if any, avoid multiple connections with same requestId
    await closeMcpConnection({ requestId });
  }
  mcpConnections.set(requestId, mcpClient as McpClient);
  const serverCapabilities = mcpClient.getServerCapabilities();
  const primitivePromises: Promise<any>[] = [];
  // get server primitives if supported
  if (serverCapabilities?.tools) {
    primitivePromises.push(mcpClient.listTools());
  }
  if (serverCapabilities?.resources) {
    primitivePromises.push(mcpClient.listResources());
    primitivePromises.push(mcpClient.listResourceTemplates());
  }
  if (serverCapabilities?.prompts) {
    primitivePromises.push(mcpClient.listPrompts());
  }
  try {
    await Promise.all(primitivePromises);
  } catch (error) {
    console.warn('Failed to fetch one or more primitive types from MCP server', error);
  }
  // notify connection ready after capabilities and primitives are fetched
  _notifyMcpClientStateChange(mcpStateChannel, true);
  const mcpRequest = await models.mcpRequest.getById(requestId);
  invariant(mcpRequest, 'MCP Request not found');
  const { authentication } = mcpRequest;
  if ('grantType' in authentication && authentication.grantType === 'mcp_auth_flow' && !authentication.disabled) {
    // Close the oauth authorization modal after connection and server capabilities are fetched
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('hide-oauth-authorization-modal');
    });
  }
};

const closeMcpConnection = async (options: CommonMcpOptions) => {
  const { requestId } = options;
  const mcpClient = _getMcpClient(requestId);
  if (mcpClient) {
    try {
      // Only terminate session if transport is StreamableHTTPClientTransport
      if ('terminateSession' in mcpClient.transport) {
        await mcpClient.transport.terminateSession();
      }
    } catch (err) {
      _handleMcpClientError(requestId, err as Error, 'Failed to terminate MCP session');
    } finally {
      // Alway close the connection even the transport terminate session fails
      // This occurs when the server is not reachable, terminateSession failure will cause the connection to never close
      mcpClient.close();
      // Execute clear resource subscription in main process rather than UI to make sure closeAllMcpConnections method will clear subscriptions
      await models.mcpRequest.clearResourceSubscriptions(requestId);
    }
    trackSegmentEvent(SegmentEvent.mcpClientDisconnected);
  }
};

const closeAllMcpConnections = () => {
  for (const [requestId] of mcpConnections) {
    closeMcpConnection({ requestId });
  }
};

const findMany = async (options: { responseId: string }): Promise<McpEvent[]> => {
  const response = await models.mcpResponse.getById(options.responseId);
  if (!response || !response.eventLogPath) {
    return [];
  }
  const body = await fs.promises.readFile(response.eventLogPath);
  return (
    body
      .toString()
      .split('\n')
      .filter(e => e?.trim())
      // Parse the message
      .map(e => JSON.parse(e))
      // Reverse the list of messages so that we get the latest message first
      .reverse() || []
  );
};

const listTools = async (options: CommonMcpOptions) => {
  const mcpClient = _getMcpClient(options.requestId);
  if (mcpClient) {
    const tools = await mcpClient.listTools();
    return tools;
  }
  return null;
};

const callTool = async (options: CommonMcpOptions & CallToolRequest['params']) => {
  const { requestId, ...params } = options;
  const mcpClient = _getMcpClient(requestId);
  if (mcpClient) {
    const response = await mcpClient.callTool(params, CompatibilityCallToolResultSchema);
    trackSegmentEvent(SegmentEvent.mcpToolCalled);
    return response.content;
  }
  return null;
};

const listPrompts = async (options: CommonMcpOptions & ListPromptsRequest['params']) => {
  const mcpClient = _getMcpClient(options.requestId);
  if (mcpClient) {
    const prompts = await mcpClient.listPrompts();
    return prompts;
  }
  return null;
};

const getPrompt = async (options: CommonMcpOptions & GetPromptRequest['params']) => {
  const { requestId, ...params } = options;
  const mcpClient = _getMcpClient(options.requestId);
  if (mcpClient) {
    const prompt = await mcpClient.getPrompt(params);
    trackSegmentEvent(SegmentEvent.mcpPromptCalled);
    return prompt;
  }
  return null;
};

const listResources = async (options: CommonMcpOptions & ListResourcesRequest['params']) => {
  const { requestId, ...params } = options;
  const mcpClient = _getMcpClient(options.requestId);
  if (mcpClient) {
    const resources = await mcpClient.listResources(params);
    return resources;
  }
  return null;
};

const subscribeResource = async (options: CommonMcpOptions & SubscribeRequest['params']) => {
  const { requestId, ...params } = options;
  const mcpClient = _getMcpClient(options.requestId);
  if (mcpClient) {
    const result = await mcpClient.subscribeResource(params);
    // Subscribe resource do not have a formal response schema, so we log it manually
    const messageEvent: Omit<McpMessageEventWithoutBase, 'data'> & { data: {} } = {
      type: 'message',
      method: METHOD_SUBSCRIBE_RESOURCE,
      data: result,
      direction: 'INCOMING',
    };
    writeEventLogAndNotify(requestId, messageEvent);
    return result;
  }
  return null;
};

const unsubscribeResource = async (options: CommonMcpOptions & UnsubscribeRequest['params']) => {
  const { requestId, ...params } = options;
  const mcpClient = _getMcpClient(options.requestId);
  if (mcpClient) {
    const result = await mcpClient.unsubscribeResource(params);
    // Unsubscribe resource do not have a formal response schema, so we log it manually
    const messageEvent: Omit<McpMessageEventWithoutBase, 'data'> & { data: {} } = {
      type: 'message',
      method: METHOD_UNSUBSCRIBE_RESOURCE,
      data: result,
      direction: 'INCOMING',
    };
    writeEventLogAndNotify(requestId, messageEvent);
    return result;
  }
  return null;
};

const listResourceTemplates = async (options: CommonMcpOptions & ListResourcesRequest['params']) => {
  const { requestId, ...params } = options;
  const mcpClient = _getMcpClient(requestId);
  if (mcpClient) {
    const resourceTemplates = await mcpClient.listResourceTemplates(params);
    return resourceTemplates;
  }
  return null;
};

const getMcpReadyState = async (options: CommonMcpOptions) => {
  try {
    const mcpClient = _getMcpClient(options.requestId);
    // if no mcp client, it means it's disconnected
    return !!mcpClient;
  } catch (error) {
    return false;
  }
};

const readResource = async (options: CommonMcpOptions & ReadResourceRequest['params']) => {
  const { requestId, ...params } = options;
  const mcpClient = _getMcpClient(requestId);
  if (mcpClient) {
    const resource = await mcpClient.readResource(params);
    trackSegmentEvent(SegmentEvent.mcpResourceRead);
    return resource;
  }
  return null;
};

const sendRootListChangeNotification = async (options: CommonMcpOptions) => {
  const mcpClient = _getMcpClient(options.requestId);
  if (mcpClient) {
    const result = await mcpClient.sendRootsListChanged();
    return result;
  }
  return null;
};

export interface McpBridgeAPI {
  connect: typeof openMcpClientConnection;
  close: typeof closeMcpConnection;
  closeAll: typeof closeAllMcpConnections;
  authConfirmation: (confirmed: boolean) => void;
  primitive: {
    listTools: typeof listTools;
    callTool: typeof callTool;
    listPrompts: typeof listPrompts;
    getPrompt: typeof getPrompt;
    listResources: typeof listResources;
    listResourceTemplates: typeof listResourceTemplates;
    readResource: typeof readResource;
    subscribeResource: typeof subscribeResource;
    unsubscribeResource: typeof unsubscribeResource;
  };
  readyState: {
    getCurrent: typeof getMcpReadyState;
  };
  notification: {
    rootListChange: typeof sendRootListChangeNotification;
  };
  event: {
    findMany: typeof findMany;
  };
}

export const registerMcpHandlers = () => {
  ipcMainHandle('mcp.connect', (_, options: Parameters<typeof openMcpClientConnection>[0]) =>
    openMcpClientConnection(options),
  );
  ipcMainHandle('mcp.primitive.listTools', (_, options: Parameters<typeof listTools>[0]) => listTools(options));
  ipcMainHandle('mcp.primitive.callTool', (_, options: Parameters<typeof callTool>[0]) => callTool(options));
  ipcMainHandle('mcp.primitive.listPrompts', (_, options: Parameters<typeof listPrompts>[0]) => listPrompts(options));
  ipcMainHandle('mcp.primitive.getPrompt', (_, options: Parameters<typeof getPrompt>[0]) => getPrompt(options));
  ipcMainHandle('mcp.primitive.listResources', (_, options: Parameters<typeof listResources>[0]) =>
    listResources(options),
  );
  ipcMainHandle('mcp.primitive.listResourceTemplates', (_, options: Parameters<typeof listResourceTemplates>[0]) =>
    listResourceTemplates(options),
  );
  ipcMainHandle('mcp.primitive.readResource', (_, options: Parameters<typeof readResource>[0]) =>
    readResource(options),
  );
  ipcMainHandle('mcp.primitive.subscribeResource', (_, options: Parameters<typeof subscribeResource>[0]) =>
    subscribeResource(options),
  );
  ipcMainHandle('mcp.primitive.unsubscribeResource', (_, options: Parameters<typeof unsubscribeResource>[0]) =>
    unsubscribeResource(options),
  );
  ipcMainHandle('mcp.close', (_, options: Parameters<typeof closeMcpConnection>[0]) => closeMcpConnection(options));
  ipcMainOn('mcp.closeAll', closeAllMcpConnections);
  ipcMainHandle('mcp.readyState', (_, options: Parameters<typeof getMcpReadyState>[0]) => getMcpReadyState(options));
  ipcMainHandle('mcp.event.findMany', (_, options: Parameters<typeof findMany>[0]) => findMany(options));
  ipcMainHandle('mcp.notification.rootListChange', (_, options: Parameters<typeof sendRootListChangeNotification>[0]) =>
    sendRootListChangeNotification(options),
  );
};

electron.app.on('window-all-closed', closeAllMcpConnections);
