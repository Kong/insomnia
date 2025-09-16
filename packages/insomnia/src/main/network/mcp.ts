import fs from 'node:fs';
import path from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  type ClientRequest,
  isInitializeRequest,
  type JSONRPCMessage,
  type JSONRPCResponse,
} from '@modelcontextprotocol/sdk/types.js';
import electron, { BrowserWindow } from 'electron';
import { parse } from 'shell-quote';
import { v4 as uuidV4 } from 'uuid';
import type { z } from 'zod';

import { getAppVersion, getProductName } from '~/common/constants';
import { getMcpMethodFromMessage } from '~/common/mcp-utils';
import { generateId } from '~/common/misc';
import * as models from '~/models';
import type { McpResponse } from '~/models/mcp-response';
import type { RequestAuthentication, RequestHeader } from '~/models/request';
import { getBasicAuthHeader } from '~/network/basic-auth/get-header';
import { getBearerAuthHeader } from '~/network/bearer-auth/get-header';
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
  transportType: 'streamable-http';
  headers: RequestHeader[];
  authentication: RequestAuthentication;
};
type OpenMcpStdioClientConnectionOptions = CommonMcpOptions & {
  workspaceId: string;
  // TODO: should rename to command or urlOrCommand
  url: string;
  transportType: 'stdio';
};
export type OpenMcpClientConnectionOptions = OpenMcpHTTPClientConnectionOptions | OpenMcpStdioClientConnectionOptions;
const isOpenMcpHTTPClientConnectionOptions = (
  options: OpenMcpClientConnectionOptions,
): options is OpenMcpHTTPClientConnectionOptions => {
  return options.transportType === 'streamable-http';
};
export interface McpRequestOptions {
  requestId: string;
  request: ClientRequest;
  schema: z.ZodType;
  signal?: AbortSignal;
}
interface CallToolOptions extends CommonMcpOptions {
  name: string;
  parameters: Record<string, any>;
}

interface McpCloseEvent {
  _id: string;
  requestId: string;
  type: 'close';
  timestamp: number;
  reason: string;
}
export interface McpMessageEvent {
  _id: string;
  requestId: string;
  type: 'message';
  direction: 'INCOMING';
  timestamp: number;
  data: JSONRPCResponse;
  method: string;
}
interface McpErrorEvent {
  _id: string;
  requestId: string;
  timestamp: number;
  type: 'error';
  message: string;
  error: any;
}
interface McpRequestEvent {
  _id: string;
  requestId: string;
  type: 'message';
  timestamp: number;
  direction: 'OUTGOING';
  method: string;
  data: any;
}
export type McpEvent = McpMessageEvent | McpRequestEvent | McpCloseEvent | McpErrorEvent;
interface ResponseEventOptions {
  responseId: string;
  requestId: string;
  environmentId: string | null;
  timelinePath: string;
  eventLogPath: string;
}

const mcpConnections = new Map<string, McpClient>();
const eventLogFileStreams = new Map<string, fs.WriteStream>();
const timelineFileStreams = new Map<string, fs.WriteStream>();

const protocol = 'mcp';
const getMcpStateChannel = (requestId: string) => `${protocol}.${requestId}.readyState`;
const mcpEventIdGenerator = () => `mcp-${uuidV4()}`;
const _getMcpClient = (id: string) => {
  const mcpClient = mcpConnections.get(id);
  if (!mcpClient) {
    console.log(`No existing MCP client connection found for requestId: ${id}. It might have been disconnected.`);
  }
  return mcpClient;
};

const _notifyMcpClientStateChange = (channel: string, isConnected: boolean) => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, isConnected);
  }
};

const _clearMcpMaps = (requestId: string, timelineMessage: string, event?: McpEvent) => {
  if (event) {
    eventLogFileStreams.get(requestId)?.write(JSON.stringify(event) + '\n');
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

const _handleCloseMcpConnection = (requestId: string, error?: Error) => {
  if (error) {
    const closeEvent: McpErrorEvent = {
      _id: mcpEventIdGenerator(),
      requestId,
      type: 'error',
      timestamp: Date.now(),
      error,
      message: error.message || 'Unknown error',
    };
    // clear in-memory store
    _clearMcpMaps(requestId, 'Closed MCP connection', closeEvent);
  } else {
    const closeEvent: McpCloseEvent = {
      _id: mcpEventIdGenerator(),
      requestId,
      type: 'close',
      timestamp: Date.now(),
      reason: 'Mcp connection closed',
    };
    // clear in-memory store
    _clearMcpMaps(requestId, 'Closed MCP connection', closeEvent);
  }

  const mcpStateChannel = getMcpStateChannel(requestId);
  // notify renderer process about state change
  _notifyMcpClientStateChange(mcpStateChannel, false);
};

const _handleMcpConnectionError = (requestId: string, error: Error) => {
  const messageEvent: McpErrorEvent = {
    _id: mcpEventIdGenerator(),
    requestId,
    type: 'error',
    message: error.message || 'Unknown error',
    error,
    timestamp: Date.now(),
  };
  eventLogFileStreams.get(requestId)?.write(JSON.stringify(messageEvent) + '\n');
  console.error(`MCP connection error for requestId: ${requestId}`, error);
  // _handleCloseMcpConnection(requestId);
};

const _handleMcpMessage = (message: JSONRPCMessage, requestId: string) => {
  const method = getMcpMethodFromMessage(message);

  const messageEvent: McpMessageEvent = {
    _id: mcpEventIdGenerator(),
    requestId,
    type: 'message',
    method,
    data: message as JSONRPCResponse,
    direction: 'INCOMING',
    timestamp: Date.now(),
  };
  eventLogFileStreams.get(requestId)?.write(JSON.stringify(messageEvent) + '\n');
};

const createErrorResponse = async ({
  requestId,
  responseId,
  environmentId,
  timelinePath,
  message,
}: ResponseEventOptions & { message: string }) => {
  const settings = await models.settings.get();
  const responsePatch = {
    _id: responseId,
    parentId: requestId,
    environmentId: environmentId,
    timelinePath,
    statusMessage: 'Error',
    error: message,
  };
  const res = await models.mcpResponse.create(responsePatch, settings.maxHistoryResponses);
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

// A wrapper fetch to log request and response details
const fetchWithLogging = async (
  url: string | URL,
  init: RequestInit,
  { requestId, responseId, environmentId, timelinePath, eventLogPath }: ResponseEventOptions,
) => {
  const { method = 'GET' } = init;
  const reqHeader = new Headers(init?.headers || {});
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
    };
    const settings = await models.settings.get();
    const res = await models.mcpResponse.create(responsePatch, settings.maxHistoryResponses);
    models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: res._id });
  }
  if (requestBody) {
    // Add request event
    const requestEvent: McpRequestEvent = {
      _id: mcpEventIdGenerator(),
      method: requestBody.method,
      requestId,
      type: 'message',
      direction: 'OUTGOING',
      timestamp: Date.now(),
      data: requestBody,
    };
    eventLogFileStreams.get(requestId)?.write(JSON.stringify(requestEvent) + '\n');
  }
  return response;
};

const openMcpClientConnection = async (options: OpenMcpClientConnectionOptions) => {
  const { requestId, workspaceId } = options;

  // create response model and file streams
  const responseId = generateId('res');
  const responsesDir = path.join(process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData'), 'responses');
  const eventLogPath = path.join(responsesDir, uuidV4() + '.response');
  eventLogFileStreams.set(requestId, fs.createWriteStream(eventLogPath));
  const timelinePath = path.join(responsesDir, responseId + '.timeline');
  timelineFileStreams.set(requestId, fs.createWriteStream(timelinePath));
  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);
  // fallback to base environment
  const activeEnvironmentId = workspaceMeta.activeEnvironmentId;
  const activeEnvironment = activeEnvironmentId && (await models.environment.getById(activeEnvironmentId));
  const environment = activeEnvironment || (await models.environment.getOrCreateForParentId(workspaceId));
  invariant(environment, 'failed to find environment ' + activeEnvironmentId);
  const responseEnvironmentId = environment ? environment._id : null;

  // create connection
  const mcpClient = new Client({
    name: getProductName(),
    version: getAppVersion(),
  });
  mcpClient.onclose = () => _handleCloseMcpConnection(requestId);
  mcpClient.onerror = _error => _handleMcpConnectionError(requestId, _error);
  const mcpStateChannel = getMcpStateChannel(requestId);

  const createStreamableHTTPTransport = (options: OpenMcpHTTPClientConnectionOptions) => {
    const { url, requestId } = options;
    if (!url) {
      throw new Error('MCP server url is required');
    }

    if (!options.authentication.disabled) {
      if (options.authentication.type === 'basic') {
        const { username, password, useISO88591 } = options.authentication;
        const encoding = useISO88591 ? 'latin1' : 'utf8';
        options.headers.push(getBasicAuthHeader(username, password, encoding));
      }
      if (options.authentication.type === 'apikey') {
        const { key = '', value = '' } = options.authentication;
        options.headers.push({ name: key, value: value });
      }
      if (options.authentication.type === 'bearer' && options.authentication.token) {
        const { token, prefix } = options.authentication;
        options.headers.push(getBearerAuthHeader(token, prefix));
      }
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

  const createStdioTransport = (options: OpenMcpClientConnectionOptions) => {
    const { url } = options;
    const parseResult = parse(url);
    if (parseResult.find(arg => typeof arg !== 'string')) {
      throw new Error('Invalid command format');
    }
    const [command, ...args] = parseResult as string[];
    const transport = new StdioClientTransport({
      command,
      args,
    });
    transport.onmessage = async message => {
      const method = getMcpMethodFromMessage(message);

      // TODO[MCP-STDIO]: try to find a better way to unify this with the http transport
      if (method === 'initialize') {
        const responsePatch: Partial<McpResponse> = {
          _id: responseId,
          parentId: requestId,
          environmentId: responseEnvironmentId,
          url: url.toString(),
          // elapsedTime: performance.now() - start,
          timelinePath,
          eventLogPath,
        };
        const settings = await models.settings.get();
        const res = await models.mcpResponse.create(responsePatch, settings.maxHistoryResponses);
        models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: res._id });
      }

      _handleMcpMessage(message, requestId);
    };
    return transport;
  };

  try {
    const transport = isOpenMcpHTTPClientConnectionOptions(options)
      ? await createStreamableHTTPTransport(options)
      : await createStdioTransport(options);

    await mcpClient.connect(transport!);
  } catch (error) {
    // Log error when connection fails with exception
    createErrorResponse({
      requestId,
      responseId,
      environmentId: responseEnvironmentId,
      timelinePath,
      eventLogPath,
      message: error.message || 'Something went wrong',
    });
    console.error(`Failed to create ${options.transportType} transport: ${error}`);
    return;
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
};

const closeMcpConnection = async (options: CommonMcpOptions) => {
  const { requestId } = options;
  const mcpClient = _getMcpClient(requestId);
  if (mcpClient) {
    // Only terminate session if transport is StreamableHTTPClientTransport
    if ('terminateSession' in mcpClient.transport) {
      await mcpClient.transport.terminateSession();
    }
    await mcpClient.close();
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
  if (!mcpClient) {
    return [];
  }
  const tools = await mcpClient.listTools();
  return tools;
};

const callTool = async (options: CallToolOptions) => {
  const { requestId, name, parameters } = options;
  const mcpClient = _getMcpClient(requestId);
  if (mcpClient) {
    const response = await mcpClient.callTool({ name, arguments: parameters });
    return response.content;
  }
  return null;
};

const listPrompts = async (options: CommonMcpOptions) => {
  const mcpClient = _getMcpClient(options.requestId);
  if (!mcpClient) {
    return [];
  }
  const prompts = await mcpClient.listPrompts();
  return prompts;
};

const getPrompt = async (_options: CommonMcpOptions) => {};

const listResources = async (options: CommonMcpOptions) => {
  const mcpClient = _getMcpClient(options.requestId);
  if (!mcpClient) {
    return [];
  }
  const resources = await mcpClient.listResources();
  return resources;
};

const listResourceTemplates = async (options: CommonMcpOptions) => {
  const mcpClient = _getMcpClient(options.requestId);
  if (!mcpClient) {
    return [];
  }
  const resourceTemplates = await mcpClient.listResourceTemplates();
  return resourceTemplates;
};

const getMcpReadyState = async (options: CommonMcpOptions) => {
  const mcpClient = _getMcpClient(options.requestId);
  // if no mcp client, it means it's disconnected
  return !!mcpClient;
};

const readResource = async (_options: CommonMcpOptions) => {};

const subscribeResource = async (_options: CommonMcpOptions) => {};

export interface McpBridgeAPI {
  connect: typeof openMcpClientConnection;
  close: typeof closeMcpConnection;
  closeAll: typeof closeAllMcpConnections;
  primitive: {
    listTools: typeof listTools;
    callTool: typeof callTool;
    listPrompts: typeof listPrompts;
    getPrompt: typeof getPrompt;
    listResources: typeof listResources;
    listResourceTemplates: typeof listResourceTemplates;
    readResource: typeof readResource;
    subscribeResource: typeof subscribeResource;
  };
  readyState: {
    getCurrent: typeof getMcpReadyState;
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
  ipcMainHandle('mcp.close', (_, options: Parameters<typeof closeMcpConnection>[0]) => closeMcpConnection(options));
  ipcMainOn('mcp.closeAll', closeAllMcpConnections);
  ipcMainHandle('mcp.readyState', (_, options: Parameters<typeof getMcpReadyState>[0]) => getMcpReadyState(options));
  ipcMainHandle('mcp.event.findMany', (_, options: Parameters<typeof findMany>[0]) => findMany(options));
};

electron.app.on('window-all-closed', closeAllMcpConnections);
