// domain: pure business logic - entities, value objects, and the Repository/port
// interfaces implemented by infrastructure. No I/O, no framework or runtime dependencies.
// Populated incrementally, one aggregate at a time.
export type { Entity } from './shared/entity';
export { EnvironmentKvPairDataType, EnvironmentType } from './environment/environment.entity';
export type { Environment, EnvironmentKvPairData } from './environment/environment.entity';
export type { CreateEnvironmentInput, EnvironmentRepository } from './environment/environment-repository.port';
export { getRequestTypeFromId, isGrpcRequest, isMcpRequest, isRequest, isSocketIORequest, isWebSocketRequest, REQUEST_ID_PREFIXES } from './request/any-request.entity';
export type { AnyRequest } from './request/any-request.entity';
export type { GrpcRequest, GrpcRequestBody, GrpcRequestHeader } from './request/grpc-request.entity';
export { MCP_TRANSPORT_TYPES } from './request/mcp-request.entity';
export type { McpRequest, McpTransportType } from './request/mcp-request.entity';
export type { RequestRepository } from './request/request-repository.port';
export type {
  AuthTypeAPIKey,
  AuthTypeAsap,
  AuthTypeAwsIam,
  AuthTypeBasic,
  AuthTypeBearer,
  AuthTypeDigest,
  AuthTypeHawk,
  AuthTypeNetrc,
  AuthTypeNone,
  AuthTypeNTLM,
  AuthTypeOAuth1,
  AuthTypeOAuth2,
  AuthTypeSingleToken,
  OAuth1SignatureMethod,
  OAuth2ResponseType,
  RequestAuthentication,
  RequestBody,
  RequestBodyParameter,
  RequestHeader,
  RequestParameter,
  RequestPathParameter,
} from './request/request-shared.entity';
export type { Request } from './request/request.entity';
export type { SocketIOEventListener, SocketIORequest } from './request/socket-io-request.entity';
export type { WebSocketRequest } from './request/websocket-request.entity';
export type { Workspace, WorkspaceScope } from './workspace/workspace.entity';
export type { CreateWorkspaceInput, WorkspaceRepository } from './workspace/workspace-repository.port';
