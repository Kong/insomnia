import fs from 'node:fs';

import {
  type ElicitResult,
  ElicitResultSchema,
  JSONRPCErrorSchema,
  ListRootsResultSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { BrowserWindow } from 'electron';
import { v4 as uuidV4 } from 'uuid';

import { REALTIME_EVENTS_CHANNELS } from '~/common/constants';
import { METHOD_ELICITATION_CREATE_MESSAGE, METHOD_LIST_ROOTS, METHOD_UNKNOWN } from '~/common/mcp-utils';
import type {
  CommonMcpOptions,
  McpClient,
  McpEvent,
  McpEventWithoutBase,
  McpNotificationEvent,
  McpRequestEventWithoutBase,
} from '~/main/mcp/types';
import * as models from '~/models';
import { invariant } from '~/utils/invariant';

export const protocol = 'mcp';
export const mcpConnections = new Map<string, McpClient>();
export const eventLogFileStreams = new Map<string, fs.WriteStream>();
export const timelineFileStreams = new Map<string, fs.WriteStream>();
export const requestIdToResponseIdMap = new Map<string, string>();
// map to save server elicitation requests
export const mcpServerElicitationRequests = new Map<
  string,
  Map<string | number, { resolve: (value: ElicitResult) => void; reject: (reason?: any) => void }>
>();

const mcpEventIdGenerator = () => `mcp-${uuidV4()}`;
export const getMcpStateChannel = (requestId: string) =>
  `${protocol}.${requestId}.${REALTIME_EVENTS_CHANNELS.READY_STATE}`;

export const getMcpClient = (id: string) => {
  const mcpClient = mcpConnections.get(id);
  invariant(
    mcpClient,
    `No existing MCP client connection found for requestId: ${id}. It might have been disconnected.`,
  );
  return mcpClient;
};

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
    for (const window of BrowserWindow.getAllWindows()) {
      const resId = requestIdToResponseIdMap.get(requestId);
      if (resId) {
        const notifyChannel = `${protocol}.${resId}.${channel}`;
        notifyChannel && window.webContents.send(notifyChannel);
        if (clearRequestIdMap) {
          // clean up maps after last event has been written to file
          requestIdToResponseIdMap.delete(requestId);
        }
      }
    }
  });
};

export const notifyMcpClientStateChange = (channel: string, value: any) => {
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
  mcpConnections.delete(requestId);
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

export const getMcpReadyState = async (options: CommonMcpOptions) => {
  try {
    const mcpClient = getMcpClient(options.requestId);
    // if no mcp client, it means it's disconnected
    return !!mcpClient;
  } catch (error) {
    return false;
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
