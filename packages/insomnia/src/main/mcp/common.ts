import fs from 'node:fs';

import {
  type CancelledNotification,
  type ElicitResult,
  ElicitResultSchema,
  JSONRPCErrorSchema,
  ListRootsResultSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { BrowserWindow } from 'electron';
import { Agent } from 'undici';
import { v4 as uuidV4 } from 'uuid';

import { REALTIME_EVENTS_CHANNELS } from '~/common/constants';
import {
  METHOD_ELICITATION_CREATE_MESSAGE,
  METHOD_LIST_ROOTS,
  METHOD_NOTIFICATION_CANCELLED,
  METHOD_SAMPLING_CREATE_MESSAGE,
  METHOD_UNKNOWN,
  unsupportedMethodPrefix,
} from '~/common/mcp-utils';
import type {
  CommonMcpOptions,
  McpClient,
  McpEvent,
  McpEventDirection,
  McpEventWithoutBase,
  McpNotificationEvent,
  McpReadyState,
  McpRequestEventWithoutBase,
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
}

export const protocol = 'mcp';
export const mcpConnections = new Map<string, ConnectingState | ConnectedState>();
export const eventLogFileStreams = new Map<string, fs.WriteStream>();
export const timelineFileStreams = new Map<string, fs.WriteStream>();
export const requestIdToResponseIdMap = new Map<string, string>();
export const pendingMcpRequestEventIds = new Map<
  string,
  { jsonRPCId: string; eventId: string; direction: McpEventDirection }[]
>();
// map to save server elicitation requests
export const mcpServerElicitationRequests = new Map<
  string,
  Map<string | number, { resolve: (value: ElicitResult) => void; reject: (reason?: any) => void }>
>();
// map to save abort controllers for each MCP request
export const mcpRequestAbortControllers = new Map<string, Map<string, AbortController>>();

const mcpEventIdGenerator = () => `mcp-${uuidV4()}`;
export const getMcpStateChannel = (requestId: string) =>
  `${protocol}.${requestId}.${REALTIME_EVENTS_CHANNELS.READY_STATE}`;

export const getMcpClient = (id: string) => {
  const mcpConnection = mcpConnections.get(id);
  invariant(
    mcpConnection,
    `No existing MCP client connection found for requestId: ${id}. It might have been disconnected.`,
  );
  return mcpConnection.client;
};

export function updateMcpConnectionState(
  requestId: string,
  state: ConnectingState | ConnectedState | DisconnectedState,
) {
  if (state.status === 'disconnected') {
    mcpConnections.delete(requestId);
  } else {
    mcpConnections.set(requestId, state);
  }
  notifyMcpClientStateChange(getMcpStateChannel(requestId), state.status);
}

export const writeEventLogAndNotify = (
  requestId: string,
  data: McpEventWithoutBase,
  {
    clearRequestIdMap = false,
    newLine = true,
    channel = REALTIME_EVENTS_CHANNELS.NEW_EVENT,
  }: {
    clearRequestIdMap?: boolean;
    newLine?: boolean;
    channel?: string;
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
    const resId = requestIdToResponseIdMap.get(requestId);
    if (resId) {
      const notifyChannel = `${protocol}.${resId}.${channel}`;
      notifyMcpClientStateChange(notifyChannel);
      if (clearRequestIdMap) {
        // clean up maps after last event has been written to file
        requestIdToResponseIdMap.delete(requestId);
      }
    }
  });
  const pendingEventIds = pendingMcpRequestEventIds.get(requestId);
  if (pendingEventIds) {
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
      const isErrorRequest = 'error' in data && data.error;
      const isServerRequest =
        eventMethod === METHOD_ELICITATION_CREATE_MESSAGE ||
        eventMethod === METHOD_SAMPLING_CREATE_MESSAGE ||
        eventMethod === METHOD_LIST_ROOTS;
      if (eventMethod === METHOD_NOTIFICATION_CANCELLED) {
        // find the cancelled notification message indicates cancellation of the request
        removePendingEvent(e => e.jsonRPCId === (data as CancelledNotification).params.requestId);
      } else if (jsonRPCId !== null && !isUnsupportedMethod && !isErrorRequest) {
        if (direction === 'OUTGOING') {
          if (isServerRequest) {
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
            removePendingEvent(e => e.jsonRPCId === jsonRPCId && e.direction === 'OUTGOING');
          }
        }
      }
    } else if (eventData.type === 'error' && eventData.error?.requestId) {
      const errorRequestId = eventData.error.requestId;
      // Remove pending event from map on error response from server
      removePendingEvent(e => e.jsonRPCId === errorRequestId);
    }
  }
};

export const notifyMcpClientStateChange = (channel: string, value?: McpReadyState) => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, value);
  }
};

export const parseAndLogMcpRequest = (requestId: string, message: any) => {
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

export const clearMcpMaps = (requestId: string, timelineMessage: string, event?: McpEventWithoutBase) => {
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
  pendingMcpRequestEventIds.delete(requestId);
  mcpRequestAbortControllers.delete(requestId);
  mcpServerElicitationRequests.delete(requestId);
};

const getAllEvents = async (options: { responseId: string }): Promise<McpEvent[]> => {
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

export const findMany = async (options: { responseId: string }): Promise<McpEvent[]> => {
  return (await getAllEvents(options)).filter(e => e.type !== 'notification');
};

export const findNotifications = async (options: { responseId: string }): Promise<McpNotificationEvent[]> => {
  return (await getAllEvents(options)).filter(e => e.type === 'notification') as McpNotificationEvent[];
};

export const findPendingEvents = async (options: CommonMcpOptions): Promise<string[]> => {
  const pendingEventIds = pendingMcpRequestEventIds.get(options.requestId);
  if (pendingEventIds) {
    return pendingEventIds.map(e => e.eventId);
  }
  return [];
};

export const getMcpReadyState = async (options: CommonMcpOptions) => {
  try {
    const mcpConnection = mcpConnections.get(options.requestId);
    return mcpConnection ? mcpConnection.status : 'disconnected';
  } catch (error) {
    return 'disconnected';
  }
};

export const hasRequestResponded = async ({
  requestId,
  serverRequestId,
}: CommonMcpOptions & { serverRequestId: string }) => {
  const hasResponded = true;
  const pendingServerRequestResolvers = mcpServerElicitationRequests.get(requestId);
  if (pendingServerRequestResolvers) {
    return !pendingServerRequestResolvers.has(serverRequestId);
  }
  return hasResponded;
};

export const setAbortControllerForMcpRequest = (options: { messageId: string } & CommonMcpOptions) => {
  const { requestId, messageId } = options;
  const abortControllersForRequest = mcpRequestAbortControllers.get(requestId) || new Map();
  if (!mcpRequestAbortControllers.has(requestId)) {
    mcpRequestAbortControllers.set(requestId, abortControllersForRequest);
  }
  const abortController = new AbortController();
  abortControllersForRequest.set(messageId, abortController);
  return abortController;
};

export const clearAbortControllerForMcpRequest = (options: { messageId: string } & CommonMcpOptions) => {
  const { requestId, messageId } = options;
  const abortControllersForRequest = mcpRequestAbortControllers.get(requestId);
  if (abortControllersForRequest) {
    abortControllersForRequest.delete(messageId);
  }
};

export const cancelRequest = async (options: { messageId: string } & CommonMcpOptions) => {
  const { requestId, messageId } = options;
  const abortControllersForRequest = mcpRequestAbortControllers.get(requestId);
  if (abortControllersForRequest) {
    const abortController = abortControllersForRequest.get(messageId);
    if (abortController) {
      abortController.abort();
      abortControllersForRequest.delete(messageId);
    }
  }
};

// To support MCP requests with custom CA certificates
export const getFetchDispatcher = async (requestId: string) => {
  const mcpRequest = await models.mcpRequest.getById(requestId);
  invariant(mcpRequest, 'McpRequest not found');
  const workspaceId = mcpRequest.parentId;
  const workspaceCaCert = await models.caCertificate.findByParentId(workspaceId);

  return new Agent({
    connect: {
      ...(workspaceCaCert?.path && !workspaceCaCert?.disabled
        ? { ca: await insecureReadFile(workspaceCaCert.path) }
        : {}),
    },
  });
};
