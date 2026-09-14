import type { AllTypes } from 'insomnia-data';

export type AllExportTypes =
  | 'request'
  | 'mcp_request'
  | 'grpc_request'
  | 'websocket_request'
  | 'websocket_payload'
  | 'socketio_request'
  | 'socketio_payload'
  | 'mock'
  | 'mock_route'
  | 'request_group'
  | 'unit_test_suite'
  | 'unit_test'
  | 'workspace'
  | 'cookie_jar'
  | 'environment'
  | 'api_spec'
  | 'proto_file'
  | 'proto_directory';

// All models that can be exported should be listed here
export const MODELS_BY_EXPORT_TYPE: Record<AllExportTypes, AllTypes> = {
  request: 'Request',
  mcp_request: 'McpRequest',
  websocket_payload: 'WebSocketPayload',
  websocket_request: 'WebSocketRequest',
  socketio_payload: 'SocketIOPayload',
  socketio_request: 'SocketIORequest',
  mock: 'MockServer',
  mock_route: 'MockRoute',
  grpc_request: 'GrpcRequest',
  request_group: 'RequestGroup',
  unit_test_suite: 'UnitTestSuite',
  unit_test: 'UnitTest',
  workspace: 'Workspace',
  cookie_jar: 'CookieJar',
  environment: 'Environment',
  api_spec: 'ApiSpec',
  proto_file: 'ProtoFile',
  proto_directory: 'ProtoDirectory',
};
