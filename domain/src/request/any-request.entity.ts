import type { GrpcRequest } from './grpc-request.entity';
import type { McpRequest } from './mcp-request.entity';
import type { Request } from './request.entity';
import type { SocketIORequest } from './socket-io-request.entity';
import type { WebSocketRequest } from './websocket-request.entity';

/** The RequestRepository aggregate root: one repository, five request variants. */
export type AnyRequest = Request | GrpcRequest | WebSocketRequest | SocketIORequest | McpRequest;

export const REQUEST_ID_PREFIXES = {
  Request: 'req',
  GrpcRequest: 'greq',
  WebSocketRequest: 'ws-req',
  SocketIORequest: 'socketio-req',
  McpRequest: 'mcp-req',
} as const;

export const isRequest = (request: Pick<AnyRequest, 'type'>): request is Request => request.type === 'Request';
export const isGrpcRequest = (request: Pick<AnyRequest, 'type'>): request is GrpcRequest =>
  request.type === 'GrpcRequest';
export const isWebSocketRequest = (request: Pick<AnyRequest, 'type'>): request is WebSocketRequest =>
  request.type === 'WebSocketRequest';
export const isSocketIORequest = (request: Pick<AnyRequest, 'type'>): request is SocketIORequest =>
  request.type === 'SocketIORequest';
export const isMcpRequest = (request: Pick<AnyRequest, 'type'>): request is McpRequest =>
  request.type === 'McpRequest';

/** Which request variant an id belongs to, based on its prefix - mirrors each variant's own isXId() guard. */
export const getRequestTypeFromId = (id: string): AnyRequest['type'] | null => {
  if (id.startsWith(`${REQUEST_ID_PREFIXES.GrpcRequest}_`)) return 'GrpcRequest';
  if (id.startsWith(`${REQUEST_ID_PREFIXES.WebSocketRequest}_`)) return 'WebSocketRequest';
  if (id.startsWith(`${REQUEST_ID_PREFIXES.SocketIORequest}_`)) return 'SocketIORequest';
  if (id.startsWith(`${REQUEST_ID_PREFIXES.McpRequest}_`)) return 'McpRequest';
  if (id.startsWith(`${REQUEST_ID_PREFIXES.Request}_`)) return 'Request';
  return null;
};
