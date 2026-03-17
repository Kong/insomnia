import fs from 'node:fs';
import path from 'node:path';

import {
  type CancelledNotification,
  type CreateMessageResult,
  CreateMessageResultSchema,
  type ElicitResult,
  ElicitResultSchema,
  JSONRPCErrorSchema,
  ListRootsResultSchema,
} from '@modelcontextprotocol/sdk/types.js';
import electron from 'electron';
import { BrowserWindow } from 'electron';
import { Agent } from 'undici';
import { v4 as uuidV4 } from 'uuid';

import { REALTIME_EVENTS_CHANNELS } from '~/common/constants';
import {
  MCP_SERVER_REQUEST_METHODS,
  METHOD_ELICITATION_CREATE_MESSAGE,
  METHOD_JSONRPC_ERROR,
  METHOD_LIST_ROOTS,
  METHOD_NOTIFICATION_CANCELLED,
  METHOD_SAMPLING_CREATE_MESSAGE,
  METHOD_UNKNOWN,
  unsupportedMethodPrefix,
} from '~/common/mcp-utils';
import { generateId } from '~/common/misc';
import { services } from '~/insomnia-data';
import type {
  CommonMcpOptions,
  McpClient,
  McpEvent,
  McpEventDirection,
  McpEventWithoutBase,
  McpNotificationEvent,
  McpReadyState,
  McpRequestEventWithoutBase,
  OpenMcpClientConnectionOptions,
} from '~/main/mcp/types';
import { insecureReadFile } from '~/main/secure-read-file';
import * as models from '~/models';
import { invariant } from '~/utils/invariant';

interface ConnectingState {
  status: 'connecting';
  client: McpClient | null;
}
interface ConnectedState {
  status: 'connected';
  client: McpClient;
}
interface DisconnectedState {
  status: 'disconnected';
  client: null;
}

export const protocol = 'mcp';

// Used to represent a connection context that is not yet ready
export interface NotReadyConnectionContext {
  abortController: AbortController;
}

/**
 * Connection Context - Encapsulates all state for a single MCP connection
 * This ensures connections don't interfere with each other
 */
export type ConnectionContext = {
  // Unique identifier for this connection attempt
  connectionId: string;
  requestId: string;
  workspaceId: string;
  // Response and file paths - unique to this connection
  responseId: string;
  eventLogPath: string;
  timelinePath: string;
  // File streams - owned by this connection
  eventLogStream: fs.WriteStream;
  timelineStream: fs.WriteStream;
  pendingEventIds: { jsonRPCId: string; eventId: string; direction: McpEventDirection }[];
  mcpServerElicitationRequests: Map<
    string | number,
    { resolve: (value: ElicitResult) => void; reject: (reason?: any) => void }
  >;
  mcpServerSamplingRequests: Map<
    string | number,
    { resolve: (value: CreateMessageResult) => void; reject: (reason?: any) => void }
  >;
  mcpRequestAbortControllers: Map<string, AbortController>;
  // Abort controller for this specific connection
  abortController: AbortController;
  // Environment context
  environmentId: string | null;
  // Connection options
  options: OpenMcpClientConnectionOptions;
} & (ConnectedState | ConnectingState | DisconnectedState);

export const activeConnectionContexts = new Map<string, ConnectionContext | NotReadyConnectionContext>();

export const isContextReady = (
  context?: ConnectionContext | NotReadyConnectionContext,
): context is ConnectionContext => {
  return !!context && 'connectionId' in context;
};

const getMcpPayloadOrCreateByParentIdAndUrl = async (requestId: string, url: string) => {
  const existing = await services.mcpPayload.getByParentId(requestId);
  if (!existing) {
    return await services.mcpPayload.create({ parentId: requestId, url });
  }
  return existing;
};

/**
 * Create a new connection context with all isolated state
 */
export const createConnectionContext = async (
  options: OpenMcpClientConnectionOptions,
  abortController: AbortController,
): Promise<ConnectionContext> => {
  const { requestId, workspaceId } = options;
  const connectionId = uuidV4();

  // Create response model and file streams
  const responseId = generateId(models.mcpResponse.prefix);
  const responsesDir = path.join(process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData'), 'responses');
  const eventLogPath = path.join(responsesDir, uuidV4() + '.response');
  const timelinePath = path.join(responsesDir, responseId + '.timeline');

  const eventLogStream = fs.createWriteStream(eventLogPath);
  const timelineStream = fs.createWriteStream(timelinePath);

  const pendingEventIds: { jsonRPCId: string; eventId: string; direction: McpEventDirection }[] = [];
  const mcpServerElicitationRequests = new Map();
  const mcpServerSamplingRequests = new Map();

  const mcpRequestAbortControllers = new Map();

  // Get environment
  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);
  const activeEnvironmentId = workspaceMeta.activeEnvironmentId;
  const activeEnvironment = activeEnvironmentId && (await models.environment.getById(activeEnvironmentId));
  const environment = activeEnvironment || (await models.environment.getOrCreateForParentId(workspaceId));
  invariant(environment, 'failed to find environment ' + activeEnvironmentId);
  const environmentId = environment ? environment._id : null;

  // Create MCP payload model if not exists
  await getMcpPayloadOrCreateByParentIdAndUrl(requestId, options.url);

  const context: ConnectionContext = {
    connectionId,
    requestId,
    workspaceId,
    responseId,
    eventLogPath,
    timelinePath,
    eventLogStream,
    timelineStream,
    pendingEventIds,
    abortController,
    environmentId,
    mcpServerElicitationRequests,
    mcpServerSamplingRequests,
    mcpRequestAbortControllers,
    options,
    status: 'connecting',
    client: null,
  };

  return context;
};

export const clearConnectionContext = async (context: ConnectionContext) => {
  const { eventLogStream, timelineStream } = context;
  eventLogStream.end();
  timelineStream.end();
  // notify renderer process about state change
  updateMcpConnectionState(context, 'disconnected');

  // Clear the context from active connections map when disconnected
  if (activeConnectionContexts.get(context.requestId) === context) {
    activeConnectionContexts.delete(context.requestId);
  }
};

const mcpEventIdGenerator = () => `mcp-${uuidV4()}`;
const getMcpStateChannel = (requestId: string) => `${protocol}.${requestId}.${REALTIME_EVENTS_CHANNELS.READY_STATE}`;

export const getReadyActiveMcpConnectionContext = (requestId: string) => {
  const context = activeConnectionContexts.get(requestId);
  if (isContextReady(context)) {
    return context;
  }
  return null;
};

export const isActiveConnectionContext = (context: ConnectionContext) => {
  const activeContext = getReadyActiveMcpConnectionContext(context.requestId);
  return activeContext?.connectionId === context.connectionId;
};

export const getActiveMcpClient = (requestId: string): McpClient | null => {
  const activeContext = getReadyActiveMcpConnectionContext(requestId);
  return activeContext?.client || null;
};

export function updateMcpConnectionState(
  context: ConnectionContext,
  status: McpReadyState,
  mcpClient: McpClient | null = null,
) {
  const { requestId } = context;

  context.status = status;
  context.client = mcpClient;

  // Only notify if this context is still the active connection
  if (isActiveConnectionContext(context)) {
    _notifyMcpClientChange(getMcpStateChannel(requestId), status);
  } else if (!activeConnectionContexts.get(requestId) && status === 'disconnected') {
    //  or if there is no active context(when the map is cleared but the connection is not closed yet)
    _notifyMcpClientChange(getMcpStateChannel(requestId), 'disconnected');
  }
}

export const writeTimeline = (context: ConnectionContext, chunk: string) => {
  const { timelineStream } = context;

  // The write stream may be closed when closing the connection
  if (!timelineStream.closed) {
    timelineStream.write(chunk + '\n');
  }
};

export const writeEventLogAndNotify = (
  context: ConnectionContext,
  data: McpEventWithoutBase,
  {
    newLine = true,
    channel = REALTIME_EVENTS_CHANNELS.NEW_EVENT,
  }: {
    newLine?: boolean;
    channel?: string;
  } = {},
) => {
  const { requestId, responseId, eventLogStream, pendingEventIds } = context;

  const eventData: McpEvent = {
    ...data,
    _id: mcpEventIdGenerator(),
    requestId,
    timestamp: Date.now(),
  };
  const stringifiedData = JSON.stringify(eventData);
  const dataToWrite = newLine ? stringifiedData + '\n' : stringifiedData;
  // The write stream may be ended when closing the connection
  if (!eventLogStream.writableEnded) {
    eventLogStream.write(dataToWrite, () => {
      // notify all renderers of new event has been received
      if (responseId) {
        const notifyChannel = `${protocol}.${responseId}.${channel}`;
        _notifyMcpClientChange(notifyChannel);
      }
    });
  }

  const removePendingEvent = (condition: (value: { jsonRPCId: string; direction: McpEventDirection }) => unknown) => {
    if (pendingEventIds.length > 0) {
      const index = pendingEventIds.findIndex(condition);
      if (index !== -1) {
        pendingEventIds.splice(index, 1);
      }
    }
  };

  if (eventData.type === 'message') {
    const { direction, data } = eventData;
    const jsonRPCId = 'id' in data ? data.id : null;
    const eventMethod = eventData.method;
    const isUnsupportedMethod = eventMethod.startsWith(unsupportedMethodPrefix);
    // for server response with error like { method: 'JSON-RPC Error', type: 'message', data: {…}}
    const isJsonRPCError = eventMethod === METHOD_JSONRPC_ERROR;
    const isServerRequest = MCP_SERVER_REQUEST_METHODS.includes(eventMethod);
    if (eventMethod === METHOD_NOTIFICATION_CANCELLED) {
      // find the cancelled notification message indicates cancellation of the request
      removePendingEvent(e => e.jsonRPCId === (data as CancelledNotification).params.requestId);
    } else if (jsonRPCId !== null && !isUnsupportedMethod) {
      if (isJsonRPCError) {
        // for json-rpc error response, remove from corresponding pending events
        removePendingEvent(e => e.jsonRPCId === jsonRPCId);
      } else {
        // for normal request/response messages
        if (direction === 'OUTGOING') {
          if (isServerRequest) {
            // client responses server incoming requests, remove from corresponding pending events
            removePendingEvent(e => e.jsonRPCId === jsonRPCId && e.direction === 'INCOMING');
          } else {
            // Track mcp client outgoing requests
            pendingEventIds.push({ jsonRPCId, eventId: eventData._id, direction });
          }
        } else if (direction === 'INCOMING') {
          if (isServerRequest) {
            // Track mcp server incoming requests
            pendingEventIds.push({ jsonRPCId, eventId: eventData._id, direction });
          } else {
            // Server response received, remove from corresponding pending events
            removePendingEvent(e => e.jsonRPCId === jsonRPCId && e.direction === 'OUTGOING');
          }
        }
      }
    }
  } else if (eventData.type === 'error' && eventData.error?.requestId) {
    const errorRequestId = eventData.error.requestId;
    // Remove pending event from map on error response from server
    removePendingEvent(e => e.jsonRPCId === errorRequestId);
  }
};

const _notifyMcpClientChange = (channel: string, value?: McpReadyState) => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, value);
  }
};

export const parseAndLogMcpRequest = (context: ConnectionContext, message: any) => {
  if (message) {
    // Add request event
    let requestMethod = message?.method;
    if (!requestMethod) {
      if (ListRootsResultSchema.safeParse(message?.result).success) {
        requestMethod = METHOD_LIST_ROOTS;
      } else if (ElicitResultSchema.safeParse(message?.result).success) {
        requestMethod = METHOD_ELICITATION_CREATE_MESSAGE;
      } else if (CreateMessageResultSchema.safeParse(message?.result).success) {
        requestMethod = METHOD_SAMPLING_CREATE_MESSAGE;
      } else if (JSONRPCErrorSchema.safeParse(message).success) {
        requestMethod = METHOD_JSONRPC_ERROR;
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
    writeEventLogAndNotify(context, requestEvent);
  }
};

const getAllEvents = async (options: { responseId: string }): Promise<McpEvent[]> => {
  const response = await services.mcpResponse.getById(options.responseId);
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

export const findMany = async (options: { responseId: string }): Promise<McpEvent[]> => {
  return (await getAllEvents(options)).filter(e => e.type !== 'notification');
};

export const findNotifications = async (options: { responseId: string }): Promise<McpNotificationEvent[]> => {
  return (await getAllEvents(options)).filter(e => e.type === 'notification') as McpNotificationEvent[];
};

export const findPendingEvents = async (options: CommonMcpOptions): Promise<string[]> => {
  const context = getReadyActiveMcpConnectionContext(options.requestId);
  if (context?.pendingEventIds) {
    return context?.pendingEventIds.map(e => e.eventId);
  }
  return [];
};

export const getMcpReadyState = async (options: CommonMcpOptions) => {
  const context = getReadyActiveMcpConnectionContext(options.requestId);
  return context?.status || 'disconnected';
};

export const hasRequestResponded = async ({
  requestId,
  serverRequestId,
}: CommonMcpOptions & { serverRequestId: string }) => {
  const hasResponded = true;
  const context = getReadyActiveMcpConnectionContext(requestId);

  if (context) {
    const { mcpServerElicitationRequests, mcpServerSamplingRequests } = context;
    return !mcpServerElicitationRequests.has(serverRequestId) && !mcpServerSamplingRequests.has(serverRequestId);
  }

  return hasResponded;
};

export const setAbortControllerForMcpRequest = (
  context: ConnectionContext,
  options: { messageId: string } & CommonMcpOptions,
) => {
  const { mcpRequestAbortControllers } = context;
  const { messageId } = options;

  const abortController = new AbortController();
  mcpRequestAbortControllers.set(messageId, abortController);
  return abortController;
};

export const clearAbortControllerForMcpRequest = (
  context: ConnectionContext,
  options: { messageId: string } & CommonMcpOptions,
) => {
  const { mcpRequestAbortControllers } = context;
  const { messageId } = options;

  mcpRequestAbortControllers.delete(messageId);
};

export const cancelRequest = async (options: { messageId: string } & CommonMcpOptions) => {
  const { requestId, messageId } = options;
  const context = getReadyActiveMcpConnectionContext(requestId);
  if (!context) {
    return;
  }

  const { mcpRequestAbortControllers } = context;

  const abortController = mcpRequestAbortControllers.get(messageId);
  if (abortController) {
    abortController.abort();
    mcpRequestAbortControllers.delete(messageId);
  }
};

// To support MCP requests with custom CA certificates
export const getFetchDispatcher = async (requestId: string) => {
  const mcpRequest = await services.mcpRequest.getById(requestId);
  invariant(mcpRequest, 'McpRequest not found');
  const workspaceId = mcpRequest.parentId;
  const workspaceCaCert = await services.caCertificate.getByParentId(workspaceId);

  return new Agent({
    connect: {
      ...(workspaceCaCert?.path && !workspaceCaCert?.disabled
        ? { ca: await insecureReadFile(workspaceCaCert.path) }
        : {}),
      ...(mcpRequest.sslValidation === false ? { rejectUnauthorized: false } : {}),
    },
  });
};
