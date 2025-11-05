import fs from 'node:fs';
import path from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  CancelledNotificationSchema,
  ElicitRequestSchema,
  EmptyResultSchema,
  JSONRPCErrorSchema,
  type JSONRPCMessage,
  type JSONRPCRequest,
  type JSONRPCResponse,
  ListRootsRequestSchema,
  ServerNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';
import electron from 'electron';
import { v4 as uuidV4 } from 'uuid';

import { getAppVersion, getProductName, REALTIME_EVENTS_CHANNELS } from '~/common/constants';
import { getMcpMethodFromMessage, METHOD_NOTIFICATION_CANCELLED } from '~/common/mcp-utils';
import { generateId } from '~/common/misc';
import { SegmentEvent, trackSegmentEvent } from '~/main/analytics';
import {
  callTool,
  getPrompt,
  listPrompts,
  listResources,
  listResourceTemplates,
  listTools,
  readResource,
  responseElicitationRequest,
  sendRootListChangeNotification,
  subscribeResource,
  unsubscribeResource,
} from '~/main/mcp/client-requests';
import {
  clearMcpMaps,
  eventLogFileStreams,
  findMany,
  findNotifications,
  getMcpClient,
  getMcpReadyState,
  hasRequestResponded,
  mcpConnections,
  mcpServerElicitationRequests,
  parseAndLogMcpRequest,
  requestIdToResponseIdMap,
  timelineFileStreams,
  updateMcpConnectionState,
  writeEventLogAndNotify,
} from '~/main/mcp/common';
import { McpOAuthClientProvider } from '~/main/mcp/oauth-client-provider';
import { createStdioTransport } from '~/main/mcp/transport-stdio';
import { createStreamableHTTPTransport } from '~/main/mcp/transport-streamable-http';
import type {
  McpClient,
  McpErrorEventWithoutBase,
  McpEventWithoutBase,
  McpNotificationEventWithoutBase,
  OpenMcpClientConnectionOptions,
  OpenMcpHTTPClientConnectionOptions,
} from '~/main/mcp/types';
import * as models from '~/models';
import { TRANSPORT_TYPES, type TransportType } from '~/models/mcp-request';
import { prefix as mcpResponsePrefix } from '~/models/mcp-response';
import { invariant } from '~/utils/invariant';

import { ipcMainHandle, ipcMainOn } from '../ipc/electron';

// Mcp connection and request options
interface CommonMcpOptions {
  requestId: string;
}

const _handleCloseMcpConnection = (requestId: string) => {
  const closeEvent: McpEventWithoutBase = {
    type: 'close',
    reason: 'Mcp connection closed',
  };
  // clear in-memory store
  clearMcpMaps(requestId, 'Closed MCP connection', closeEvent);

  // notify renderer process about state change
  updateMcpConnectionState(requestId, { status: 'disconnected' });
};

const _handleMcpMessage = (message: JSONRPCMessage, requestId: string) => {
  let messageEvent: McpEventWithoutBase | McpErrorEventWithoutBase | McpNotificationEventWithoutBase;
  let channel = REALTIME_EVENTS_CHANNELS.NEW_EVENT;
  if (JSONRPCErrorSchema.safeParse(message).success) {
    // Error message
    const parsedError = JSONRPCErrorSchema.parse(message);
    const { code: errorCode, message: originErrorMessage, data: errorData } = parsedError.error;
    let errorMessage = originErrorMessage;
    try {
      // Try to parse error message to JSON if possible
      errorMessage = JSON.parse(originErrorMessage);
    } catch (error) {}
    messageEvent = {
      type: 'error',
      error: {
        code: errorCode,
        requestId: parsedError.id,
        message: errorMessage,
      },
      message: `MCP Error ${errorCode}`,
    };
    if (errorData) {
      messageEvent.error.data = errorData;
    }
  } else if (ServerNotificationSchema.safeParse(message).success) {
    const notificationMethod = getMcpMethodFromMessage(message);
    // Server notification message
    messageEvent = {
      type: 'notification',
      direction: 'INCOMING',
      method: notificationMethod,
      data: ServerNotificationSchema.parse(message),
    };
    if (notificationMethod === METHOD_NOTIFICATION_CANCELLED) {
      // Write cancelled notification event to both event and notification channel
      // This is used to terminate pending server requests waiting for elicitation response
      writeEventLogAndNotify(
        requestId,
        {
          ...messageEvent,
          type: 'message',
        },
        { channel },
      );
    }
    channel = REALTIME_EVENTS_CHANNELS.MCP_NOTIFICATION;
  } else {
    if ('result' in message && EmptyResultSchema.safeParse(message.result).success) {
      console.info('Ignoring empty result message');
      // ignore empty result message, this is used for resources subscribe and unsubscribe without a formal response schema
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
  writeEventLogAndNotify(requestId, messageEvent, { channel });
};

const _handleTransportError = (message: JSONRPCRequest, requestId: string, error: Error) => {
  const messageEvent: McpErrorEventWithoutBase = {
    type: 'error',
    message: error.message || 'Transport Error',
    error: {
      requestId: message.id,
      message: error.message || 'Transport Error',
    },
  };
  writeEventLogAndNotify(requestId, messageEvent);
  console.error(`Transport error for ${requestId}`, error);
};

const _handleMcpClientError = (requestId: string, error: Error, prefix?: string) => {
  const errorMessage = error.message || '';
  const messageEvent: McpEventWithoutBase = {
    type: 'error',
    message: prefix || 'Unknown error',
    error: errorMessage,
  };
  writeEventLogAndNotify(requestId, messageEvent);
  console.error(`MCP client error for ${requestId}`, error);
};

const createErrorResponse = async ({
  requestId,
  responseId,
  environmentId,
  timelinePath,
  message,
  transportType,
}: {
  responseId: string;
  requestId: string;
  environmentId: string | null;
  timelinePath: string;
  message: string;
  transportType: TransportType;
}) => {
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

export const isOpenMcpHTTPClientConnectionOptions = (
  options: OpenMcpClientConnectionOptions,
): options is OpenMcpHTTPClientConnectionOptions => {
  return options.transportType === TRANSPORT_TYPES.HTTP;
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
  let transport: StdioClientTransport | StreamableHTTPClientTransport;
  // Wrap the transport to log messages and errors, must be called before connecting the transport
  const wrapTransport = () => {
    // Add message handler
    transport.onmessage = message => _handleMcpMessage(message, connectionOptions.requestId);
    const originalSend = transport.send.bind(transport);
    transport.send = (message: JSONRPCRequest) => {
      // Log outgoing request
      parseAndLogMcpRequest(connectionOptions.requestId, message);
      return originalSend(message).catch(err => {
        // Capture transport send error and log as MCP error event
        _handleTransportError(message, connectionOptions.requestId, err);
        // Re-throw the error to propagate it to the client caller
        throw err;
      });
    };
  };

  if (!isOpenMcpHTTPClientConnectionOptions(connectionOptions)) {
    transport = await createStdioTransport(connectionOptions, options);
    wrapTransport();
    await mcpClient.connect(transport);
  } else {
    const mcpRequest = await models.mcpRequest.getById(connectionOptions.requestId);
    invariant(mcpRequest, 'MCP Request not found');

    const authProvider = new McpOAuthClientProvider(mcpRequest);
    transport = await createStreamableHTTPTransport(connectionOptions, {
      ...options,
      authProvider,
    });
    wrapTransport();
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

  const currentConnectionState = mcpConnections.get(requestId);
  if (currentConnectionState) {
    if (currentConnectionState.status === 'connected') {
      // close existing connection if any, avoid multiple connections with same requestId
      await closeMcpConnection({ requestId });
    } else if (currentConnectionState.status === 'connecting') {
      // if connecting, should not attempt to create another connection
      // TODO: should find a way to close the pending connection safely and create a new one instead
      console.error(`MCP client is already connecting for requestId: ${requestId}`);
      return;
    }
  }
  updateMcpConnectionState(requestId, { status: 'connecting', client: null });

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

  // create MCP payload model if not exists
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

        // declare the client to support elicitation
        elicitation: {},
      },
    },
  );
  // const mcpStateChannel = getMcpStateChannel(requestId);
  updateMcpConnectionState(requestId, {
    status: 'connecting',
    client: mcpClient as McpClient,
  });

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
      message: error.message || 'Something went wrong',
      transportType: options.transportType,
    });
    console.error(`Failed to create ${options.transportType} transport: ${error}`);
    _handleCloseMcpConnection(requestId);
    return;
  }
  // Add roots request handler to indicate the client supports it
  mcpClient.setRequestHandler(ListRootsRequestSchema, async () => {
    const mcpRequest = await models.mcpRequest.getById(requestId);
    invariant(mcpRequest, 'MCP request not found');
    return { roots: mcpRequest.roots };
  });

  // Add elicitation request handler to indicate the client supports it
  mcpClient.setRequestHandler(ElicitRequestSchema, async (_request, extra) => {
    return new Promise((resolve, reject) => {
      const serverRequestId = extra.requestId;
      const pendingServerRequestResolvers = mcpServerElicitationRequests.get(requestId) || new Map();
      if (!mcpServerElicitationRequests.has(requestId)) {
        mcpServerElicitationRequests.set(requestId, pendingServerRequestResolvers);
      }
      pendingServerRequestResolvers.set(serverRequestId, { resolve, reject });
    });
  });

  mcpClient.setNotificationHandler(CancelledNotificationSchema, notification => {
    const serverRequestId = notification.params.requestId;
    // handle server request cancellation
    const pendingServerRequestResolvers = mcpServerElicitationRequests.get(requestId);
    if (pendingServerRequestResolvers && pendingServerRequestResolvers.has(serverRequestId)) {
      console.log('Received server request cancellation notification', serverRequestId);
      pendingServerRequestResolvers.delete(serverRequestId);
    }
  });

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
  updateMcpConnectionState(requestId, { status: 'connected', client: mcpClient as McpClient });
};

const closeMcpConnection = async (options: CommonMcpOptions) => {
  const { requestId } = options;
  const mcpClient = getMcpClient(requestId);
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
  client: {
    responseElicitationRequest: typeof responseElicitationRequest;
    hasRequestResponded: typeof hasRequestResponded;
  };
  readyState: {
    getCurrent: typeof getMcpReadyState;
  };
  notification: {
    rootListChange: typeof sendRootListChangeNotification;
  };
  event: {
    findMany: typeof findMany;
    findNotifications: typeof findNotifications;
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
  ipcMainHandle('mcp.event.findNotifications', (_, options: Parameters<typeof findNotifications>[0]) =>
    findNotifications(options),
  );
  ipcMainHandle('mcp.notification.rootListChange', (_, options: Parameters<typeof sendRootListChangeNotification>[0]) =>
    sendRootListChangeNotification(options),
  );
  ipcMainOn('mcp.client.responseElicitationRequest', (_, options: Parameters<typeof responseElicitationRequest>[0]) =>
    responseElicitationRequest(options),
  );
  ipcMainHandle('mcp.client.hasRequestResponded', (_, options: Parameters<typeof hasRequestResponded>[0]) =>
    hasRequestResponded(options),
  );
};

electron.app.on('window-all-closed', closeAllMcpConnections);
