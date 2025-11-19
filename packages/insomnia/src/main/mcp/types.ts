import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { ClientRequest, JSONRPCResponse, Notification } from '@modelcontextprotocol/sdk/types.js';
import type z from 'zod';

import type { TRANSPORT_TYPES } from '~/models/mcp-request';
import type { RequestAuthentication, RequestHeader } from '~/models/request';

// Refer the SDK: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/src/shared/protocol.ts#L504
// The Client type has missing transport property
export type McpClient = Client & { transport: StreamableHTTPClientTransport | StdioClientTransport };

export interface McpRequestOptions {
  requestId: string;
  request: ClientRequest;
  schema: z.ZodType;
  signal?: AbortSignal;
}

export interface McpEventBase {
  _id: string;
  requestId: string;
  timestamp: number;
}
export interface McpCloseEventWithoutBase {
  type: 'close';
  reason: string;
}
export interface McpMessageEventWithoutBase {
  type: 'message';
  direction: 'INCOMING';
  data: JSONRPCResponse | {};
  method: string;
}
export type McpMessageEvent = McpEventBase & McpMessageEventWithoutBase;
export interface McpErrorEventWithoutBase {
  type: 'error';
  message: string;
  error: any;
}
export interface McpRequestEventWithoutBase {
  type: 'message';
  direction: 'OUTGOING';
  method: string;
  data: any;
}
export interface McpNotificationEventWithoutBase {
  type: 'notification';
  method: string;
  direction: 'INCOMING';
  data: Notification;
}
export interface McpAuthEventWithoutBase {
  type: 'message';
  method: 'MCP Auth';
  direction: 'OUTGOING' | 'INCOMING';
  data: Record<string, any>;
}

export type McpNotificationEvent = McpEventBase & McpNotificationEventWithoutBase;
export type McpEventWithoutBase =
  | McpMessageEventWithoutBase
  | McpRequestEventWithoutBase
  | McpCloseEventWithoutBase
  | McpErrorEventWithoutBase
  | McpNotificationEventWithoutBase
  | McpAuthEventWithoutBase;
export type McpEvent = McpEventBase & McpEventWithoutBase;

export interface CommonMcpOptions {
  requestId: string;
}

export interface OpenMcpStdioClientConnectionOptions extends CommonMcpOptions {
  workspaceId: string;
  // TODO: should rename to command or urlOrCommand
  url: string;
  transportType: typeof TRANSPORT_TYPES.STDIO;
  env: Record<string, string>;
}

export interface OpenMcpHTTPClientConnectionOptions extends CommonMcpOptions {
  workspaceId: string;
  url: string;
  transportType: typeof TRANSPORT_TYPES.HTTP;
  headers: RequestHeader[];
  authentication: RequestAuthentication;
}

export type OpenMcpClientConnectionOptions = OpenMcpHTTPClientConnectionOptions | OpenMcpStdioClientConnectionOptions;

export type McpReadyState = 'disconnected' | 'connecting' | 'connected';
export type McpEventDirection = 'INCOMING' | 'OUTGOING';
