import type { Database } from 'insomnia-storage';

import type { ApiSpec } from '~/models/api-spec';
import type { CaCertificate } from '~/models/ca-certificate';
import type { ClientCertificate } from '~/models/client-certificate';
import type { CloudProviderCredential } from '~/models/cloud-credential';
import type { CookieJar } from '~/models/cookie-jar';
import type { Environment } from '~/models/environment';
import type { GitCredentials } from '~/models/git-credentials';
import type { GitRepository } from '~/models/git-repository';
import type { GrpcRequest } from '~/models/grpc-request';
import type { GrpcRequestMeta } from '~/models/grpc-request-meta';
import type { McpRequest } from '~/models/mcp-request';
import type { McpPayload } from '~/models/mcp-request-payload';
import type { McpResponse } from '~/models/mcp-response';
import type { MockRoute } from '~/models/mock-route';
import type { MockServer } from '~/models/mock-server';
import type { OAuth2Token } from '~/models/o-auth-2-token';
import type { PluginData } from '~/models/plugin-data';
import type { Project } from '~/models/project';
import type { ProtoDirectory } from '~/models/proto-directory';
import type { ProtoFile } from '~/models/proto-file';
import type { Request } from '~/models/request';
import type { RequestGroup } from '~/models/request-group';
import type { RequestGroupMeta } from '~/models/request-group-meta';
import type { RequestMeta } from '~/models/request-meta';
import type { RequestVersion } from '~/models/request-version';
import type { Response } from '~/models/response';
import type { RunnerTestResult } from '~/models/runner-test-result';
import type { Settings } from '~/models/settings';
import type { SocketIOPayload } from '~/models/socket-io-payload';
import type { SocketIORequest } from '~/models/socket-io-request';
import type { SocketIOResponse } from '~/models/socket-io-response';
import type { Stats } from '~/models/stats';
import type { UnitTest } from '~/models/unit-test';
import type { UnitTestResult } from '~/models/unit-test-result';
import type { UnitTestSuite } from '~/models/unit-test-suite';
import type { UserSession } from '~/models/user-session';
import type { WebSocketPayload } from '~/models/websocket-payload';
import type { WebSocketRequest } from '~/models/websocket-request';
import type { WebSocketResponse } from '~/models/websocket-response';
import type { Workspace } from '~/models/workspace';
import type { WorkspaceMeta } from '~/models/workspace-meta';

export interface DatabaseBuckets {
  ApiSpec: Database<ApiSpec>;
  CaCertificate: Database<CaCertificate>;
  ClientCertificate: Database<ClientCertificate>;
  CloudCredential: Database<CloudProviderCredential>;
  CookieJar: Database<CookieJar>;
  Environment: Database<Environment>;
  GitCredentials: Database<GitCredentials>;
  GitRepository: Database<GitRepository>;
  GrpcRequest: Database<GrpcRequest>;
  GrpcRequestMeta: Database<GrpcRequestMeta>;
  MockRoute: Database<MockRoute>;
  MockServer: Database<MockServer>;
  McpRequest: Database<McpRequest>;
  McpResponse: Database<McpResponse>;
  McpPayload: Database<McpPayload>;
  OAuth2Token: Database<OAuth2Token>;
  PluginData: Database<PluginData>;
  Project: Database<Project>;
  ProtoDirectory: Database<ProtoDirectory>;
  ProtoFile: Database<ProtoFile>;
  Request: Database<Request>;
  RequestGroup: Database<RequestGroup>;
  RequestGroupMeta: Database<RequestGroupMeta>;
  RequestMeta: Database<RequestMeta>;
  RequestVersion: Database<RequestVersion>;
  Response: Database<Response>;
  RunnerTestResult: Database<RunnerTestResult>;
  Settings: Database<Settings>;
  SocketIOPayload: Database<SocketIOPayload>;
  SocketIORequest: Database<SocketIORequest>;
  SocketIOResponse: Database<SocketIOResponse>;
  Stats: Database<Stats>;
  UnitTest: Database<UnitTest>;
  UnitTestResult: Database<UnitTestResult>;
  UnitTestSuite: Database<UnitTestSuite>;
  UserSession: Database<UserSession>;
  WebSocketPayload: Database<WebSocketPayload>;
  WebSocketRequest: Database<WebSocketRequest>;
  WebSocketResponse: Database<WebSocketResponse>;
  Workspace: Database<Workspace>;
  WorkspaceMeta: Database<WorkspaceMeta>;
}

let factory: () => DatabaseBuckets = () => {
  throw new Error('Database factory not initialized');
};
export function configureModel({ databaseFactory }: { databaseFactory: () => DatabaseBuckets }) {
  factory = databaseFactory;
}

export const initDatabaseBuckets = () => {
  return factory();
};
