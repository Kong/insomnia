import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol.js';
import {
  CancelledNotificationSchema,
  CreateMessageRequestSchema,
  ElicitRequestSchema,
  EmptyResultSchema,
  JSONRPCErrorSchema,
  type JSONRPCMessage,
  type JSONRPCRequest,
  type JSONRPCResponse,
  ListRootsRequestSchema,
  type Request,
  ServerNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';
import electron from 'electron';

import { getAppVersion, getProductName, REALTIME_EVENTS_CHANNELS } from '~/common/constants';
import { getMcpMethodFromMessage, METHOD_NOTIFICATION_CANCELLED } from '~/common/mcp-utils';
import { services } from '~/insomnia-data';
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
  responseSamplingRequest,
  sendRootListChangeNotification,
  subscribeResource,
  unsubscribeResource,
} from '~/main/mcp/client-requests';
import {
  activeConnectionContexts,
  type ConnectionContext,
  createConnectionContext,
  findPendingEvents,
  getReadyActiveMcpConnectionContext,
  isContextReady,
  writeTimeline,
} from '~/main/mcp/common';
import {
  cancelRequest,
  clearAbortControllerForMcpRequest,
  clearConnectionContext,
  findMany,
  findNotifications,
  getMcpReadyState,
  hasRequestResponded,
  parseAndLogMcpRequest,
  setAbortControllerForMcpRequest,
  updateMcpConnectionState,
  writeEventLogAndNotify,
} from '~/main/mcp/common';
import { isMCPAuthError, McpOAuthClientProvider } from '~/main/mcp/oauth-client-provider';
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
import { invariant } from '~/utils/invariant';

import { ipcMainHandle, ipcMainOn } from '../ipc/electron';

// Mcp connection and request options
interface CommonMcpOptions {
  requestId: string;
}

const _handleCloseMcpConnection = (context: ConnectionContext) => {
  const closeEvent: McpEventWithoutBase = {
    type: 'close',
    reason: 'Mcp connection closed',
  };
  writeEventLogAndNotify(context, closeEvent);

  writeTimeline(context, JSON.stringify({ value: 'Closed MCP connection', name: 'Text', timestamp: Date.now() }));

  clearConnectionContext(context);
};

const _handleMcpMessage = (context: ConnectionContext, message: JSONRPCMessage) => {
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
    } catch {}
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
        context,
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
  writeEventLogAndNotify(context, messageEvent, { channel });
};

const _handleTransportError = (context: ConnectionContext, message: JSONRPCRequest, error: Error) => {
  const messageEvent: McpErrorEventWithoutBase = {
    type: 'error',
    message: error.name || 'Transport Error',
    error: {
      requestId: message.id,
      message: error.message || 'Transport Error',
      ...(error.cause ? { cause: (error.cause as Error).message || String(error.cause) } : {}),
    },
  };
  writeEventLogAndNotify(context, messageEvent);
  console.error(`Transport error for ${context.requestId}`, error);
};

const _handleMcpClientError = (context: ConnectionContext, error: Error, prefix?: string) => {
  const errorMessage = error.message || '';
  const messageEvent: McpEventWithoutBase = {
    type: 'error',
    message: prefix || 'Unknown error',
    error: errorMessage,
  };
  writeEventLogAndNotify(context, messageEvent);
  console.error(`MCP client error for ${context.requestId}`, error);
};

const createErrorResponse = async (
  context: ConnectionContext,
  {
    message,
    errorType,
  }: {
    message: string;
    errorType?: string;
  },
) => {
  const { requestId, responseId, environmentId, timelinePath, options } = context;
  const settings = await services.settings.get();
  const responsePatch = {
    _id: responseId,
    parentId: requestId,
    environmentId,
    timelinePath,
    status: 'danger',
    statusMessage: 'Error',
    error: message,
    errorType,
    transportType: options.transportType,
  };

  const res = await services.mcpResponse.updateOrCreate(responsePatch, settings.maxHistoryResponses);
  services.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: res._id });
};

export const isOpenMcpHTTPClientConnectionOptions = (
  options: OpenMcpClientConnectionOptions,
): options is OpenMcpHTTPClientConnectionOptions => {
  return options.transportType === models.mcpRequest.TRANSPORT_TYPES.HTTP;
};

const createTransportAndConnect = async (context: ConnectionContext, mcpClient: Client) => {
  let transport: StdioClientTransport | StreamableHTTPClientTransport;
  // Wrap the transport to log messages and errors, must be called before connecting the transport
  const wrapTransport = () => {
    // Add message handler
    transport.onmessage = message => _handleMcpMessage(context, message);
    const originalSend = transport.send.bind(transport);
    transport.send = (message: JSONRPCRequest) => {
      // Log outgoing request
      parseAndLogMcpRequest(context, message);
      return originalSend(message).catch(err => {
        // Capture transport send error and log as MCP error event
        _handleTransportError(context, message, err);
        // Re-throw the error to propagate it to the client caller
        throw err;
      });
    };
  };

  const { options: connectionOptions } = context;

  if (!isOpenMcpHTTPClientConnectionOptions(connectionOptions)) {
    transport = await createStdioTransport(context, connectionOptions);
    wrapTransport();
    await mcpClient.connect(transport);
  } else {
    const authProvider = new McpOAuthClientProvider(context);
    transport = await createStreamableHTTPTransport(context, connectionOptions, authProvider);
    wrapTransport();
    // Use a longer timeout for initial connection to allow for auth flow to complete
    await mcpClient.connect(transport, { timeout: 3 * 60 * 1000 });
  }

  const mcpRequest = await services.mcpRequest.getById(connectionOptions.requestId);
  invariant(mcpRequest, 'MCP Request not found');

  let authType = 'none';
  if ('type' in mcpRequest.authentication) {
    authType =
      mcpRequest.authentication.type === 'oauth2'
        ? 'oauth2-' + mcpRequest.authentication.grantType
        : mcpRequest.authentication.type;
  }
  const authDisabled = 'disabled' in mcpRequest.authentication && mcpRequest.authentication.disabled;
  const isFirstConnection = !mcpRequest.connected;
  trackSegmentEvent(SegmentEvent.mcpClientConnected, {
    transportType: connectionOptions.transportType,
    firstTime: isFirstConnection,
    ...(connectionOptions.transportType === models.mcpRequest.TRANSPORT_TYPES.HTTP
      ? {
          authType,
          authDisabled,
        }
      : {}),
  });
  if (isFirstConnection) {
    // Mark as connected for the first time
    await services.mcpRequest.update(mcpRequest, { connected: true });
  }
};

const openMcpClientConnection = async (options: OpenMcpClientConnectionOptions) => {
  const activeContext = getReadyActiveMcpConnectionContext(options.requestId);
  if (activeContext) {
    closeMcpConnection(activeContext);
  }

  const abortController = new AbortController();
  activeConnectionContexts.set(options.requestId, { abortController });

  const connectionContext = await createConnectionContext(options, abortController);
  activeConnectionContexts.set(options.requestId, connectionContext);

  try {
    await performConnection(connectionContext);
  } catch (error) {
    clearConnectionContext(connectionContext);
    throw error;
  }
};

const performConnection = async (context: ConnectionContext) => {
  const { abortController, options, requestId, mcpServerElicitationRequests, mcpServerSamplingRequests } = context;
  // Check if the connection has been aborted before proceeding
  if (abortController.signal.aborted) {
    clearConnectionContext(context);
    return;
  }

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
        // declare the client to support sampling
        sampling: {},
      },
    },
  ) as McpClient;

  try {
    updateMcpConnectionState(context, 'connecting');
    await createTransportAndConnect(context, mcpClient);
    mcpClient.onclose = () => _handleCloseMcpConnection(context);
    if (abortController.signal.aborted) {
      mcpClient.close();
      return;
    }
    // Set the connected client in context after successful connection, to ensure it could be closed properly
    updateMcpConnectionState(context, 'connecting', mcpClient);
  } catch (error) {
    // Log error when connection fails with exception
    createErrorResponse(context, {
      message:
        error instanceof Error
          ? error.message + (error.cause ? `\ncause: ${(error.cause as Error).message || String(error.cause)}` : '')
          : 'Something went wrong',
      errorType: isMCPAuthError(error) ? 'auth' : '',
    });
    console.error(`Failed to create ${options.transportType} transport: ${error}`);
    _handleCloseMcpConnection(context);
    return;
  }

  // Add roots request handler to indicate the client supports it
  mcpClient.setRequestHandler(ListRootsRequestSchema, async () => {
    const mcpRequest = await services.mcpRequest.getById(requestId);
    invariant(mcpRequest, 'MCP request not found');
    return { roots: mcpRequest.roots };
  });

  // Add elicitation request handler to indicate the client supports it
  mcpClient.setRequestHandler(ElicitRequestSchema, async (_request, extra) => {
    return new Promise((resolve, reject) => {
      const serverRequestId = extra.requestId;
      mcpServerElicitationRequests.set(serverRequestId, { resolve, reject });
    });
  });

  // add sampling request handler to indicate the client supports it
  mcpClient.setRequestHandler(CreateMessageRequestSchema, async (_request, extra) => {
    return new Promise((resolve, reject) => {
      const serverRequestId = extra.requestId;
      mcpServerSamplingRequests.set(serverRequestId, { resolve, reject });
    });
  });

  mcpClient.setNotificationHandler(CancelledNotificationSchema, notification => {
    const serverRequestId = notification.params.requestId;
    // handle server request cancellation
    if (serverRequestId !== undefined) {
      if (mcpServerElicitationRequests.has(serverRequestId)) {
        console.log('Received server request cancellation notification for elicitation request', serverRequestId);
        mcpServerElicitationRequests.delete(serverRequestId);
      }
      if (mcpServerSamplingRequests.has(serverRequestId)) {
        console.log('Received server request cancellation notification for sampling request', serverRequestId);
        mcpServerSamplingRequests.delete(serverRequestId);
      }
    }
  });
  const originClientRequest = mcpClient.request.bind(mcpClient);
  mcpClient.request = <T extends AnySchema>(request: Request, resultSchema: T, options?: RequestOptions) => {
    // @ts-expect-error - need to access private property _requestMessageId to get message id
    const messageId = mcpClient._requestMessageId.toString();
    // add abort controller for each MCP client request
    const abortController = setAbortControllerForMcpRequest(context, { requestId, messageId });
    const optionsWithSignal = {
      ...options,
      signal: abortController.signal,
    };
    return originClientRequest(request, resultSchema, optionsWithSignal).finally(() => {
      // clear abort controller after request is completed
      clearAbortControllerForMcpRequest(context, { requestId, messageId });
    });
  };

  const serverCapabilities = mcpClient.getServerCapabilities();
  const primitivePromises: Promise<any>[] = [];
  // get server primitives if supported
  if (serverCapabilities?.tools) {
    primitivePromises.push(mcpClient.listTools());
  }
  if (serverCapabilities?.resources) {
    primitivePromises.push(mcpClient.listResources(), mcpClient.listResourceTemplates());
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
  updateMcpConnectionState(context, 'connected', mcpClient);
};

const closeMcpConnection = async (options: CommonMcpOptions) => {
  const { requestId } = options;
  const context = activeConnectionContexts.get(requestId);
  if (!context) {
    return;
  }

  const { abortController } = context;
  // Abort any ongoing connection
  abortController.abort();

  if (!isContextReady(context)) {
    return;
  }

  const { client } = context;
  // When client exists, it means the client connection has been established and could be closed gracefully
  if (!client) {
    return;
  }

  try {
    // Only terminate session if transport is StreamableHTTPClientTransport
    if ('terminateSession' in client.transport) {
      await client.transport.terminateSession();
    }
  } catch (err) {
    _handleMcpClientError(context, err as Error, 'Failed to terminate MCP session');
  } finally {
    // Always close the connection even the transport terminate session fails
    // This occurs when the server is not reachable, terminateSession failure will cause the connection to never close
    await client.close();
    // Execute clear resource subscription in main process rather than UI to make sure closeAllMcpConnections method will clear subscriptions
    await services.mcpRequest.clearResourceSubscriptions(requestId);
  }
  trackSegmentEvent(SegmentEvent.mcpClientDisconnected);
};

const closeAllMcpConnections = () => {
  for (const [requestId] of activeConnectionContexts) {
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
    responseSamplingRequest: typeof responseSamplingRequest;
    hasRequestResponded: typeof hasRequestResponded;
    cancelRequest: typeof cancelRequest;
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
    findPendingEvents: typeof findPendingEvents;
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
  ipcMainHandle('mcp.event.findPendingEvents', (_, options: Parameters<typeof findPendingEvents>[0]) =>
    findPendingEvents(options),
  );
  ipcMainHandle('mcp.notification.rootListChange', (_, options: Parameters<typeof sendRootListChangeNotification>[0]) =>
    sendRootListChangeNotification(options),
  );
  ipcMainOn('mcp.client.responseElicitationRequest', (_, options: Parameters<typeof responseElicitationRequest>[0]) =>
    responseElicitationRequest(options),
  );
  ipcMainOn('mcp.client.responseSamplingRequest', (_, options: Parameters<typeof responseSamplingRequest>[0]) =>
    responseSamplingRequest(options),
  );
  ipcMainHandle('mcp.client.hasRequestResponded', (_, options: Parameters<typeof hasRequestResponded>[0]) =>
    hasRequestResponded(options),
  );
  ipcMainHandle('mcp.client.cancelRequest', (_, options: Parameters<typeof cancelRequest>[0]) =>
    cancelRequest(options),
  );
};

electron.app.on('window-all-closed', closeAllMcpConnections);
