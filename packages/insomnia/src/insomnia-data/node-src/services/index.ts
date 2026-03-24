import * as apiSpecService from './api-spec';
import * as caCertificateService from './ca-certificate';
import * as clientCertificateService from './client-certificate';
import * as cloudCredentialService from './cloud-credential';
import * as cookieJarService from './cookie-jar';
import * as environmentService from './environment';
import * as gitCredentialsService from './git-credentials';
import * as gitRepositoryService from './git-repository';
import * as grpcRequestService from './grpc-request';
import * as grpcRequestMetaService from './grpc-request-meta';
import * as helpers from './helpers';
import * as mcpPayloadService from './mcp-payload';
import * as mcpRequestService from './mcp-request';
import * as mcpResponseService from './mcp-response';
import * as mockRouteService from './mock-route';
import * as mockServerService from './mock-server';
import * as oAuth2TokenService from './o-auth-2-token';
import * as pluginDataService from './plugin-data';
import * as projectService from './project';
import * as protoDirectoryService from './proto-directory';
import * as protoFileService from './proto-file';
import * as requestService from './request';
import * as requestGroupService from './request-group';
import * as requestGroupMetaService from './request-group-meta';
import * as requestMetaService from './request-meta';
import * as requestVersionService from './request-version';
import * as responseService from './response';
import * as runnerTestResultService from './runner-test-result';
import * as settingsService from './settings';
import * as socketIOPayloadService from './socket-io-payload';
import * as socketIORequestService from './socket-io-request';
import * as socketIOResponseService from './socket-io-response';
import * as statsService from './stats';
import * as unitTestService from './unit-test';
import * as unitTestResultService from './unit-test-result';
import * as unitTestSuiteService from './unit-test-suite';
import * as userSessionService from './user-session';
import * as webSocketPayloadService from './websocket-payload';
import * as webSocketRequestService from './websocket-request';
import * as webSocketResponseService from './websocket-response';
import * as workspaceService from './workspace';
import * as workspaceMetaService from './workspace-meta';

export const servicesNodeImpl = {
  apiSpec: apiSpecService,
  caCertificate: caCertificateService,
  clientCertificate: clientCertificateService,
  cloudCredential: cloudCredentialService,
  cookieJar: cookieJarService,
  environment: environmentService,
  gitCredentials: gitCredentialsService,
  gitRepository: gitRepositoryService,
  grpcRequest: grpcRequestService,
  grpcRequestMeta: grpcRequestMetaService,
  mcpPayload: mcpPayloadService,
  mcpRequest: mcpRequestService,
  mcpResponse: mcpResponseService,
  mockRoute: mockRouteService,
  mockServer: mockServerService,
  oAuth2Token: oAuth2TokenService,
  pluginData: pluginDataService,
  project: projectService,
  protoDirectory: protoDirectoryService,
  protoFile: protoFileService,
  request: requestService,
  requestGroup: requestGroupService,
  requestGroupMeta: requestGroupMetaService,
  requestMeta: requestMetaService,
  requestVersion: requestVersionService,
  response: responseService,
  runnerTestResult: runnerTestResultService,
  settings: settingsService,
  socketIOPayload: socketIOPayloadService,
  socketIORequest: socketIORequestService,
  socketIOResponse: socketIOResponseService,
  stats: statsService,
  unitTest: unitTestService,
  unitTestResult: unitTestResultService,
  unitTestSuite: unitTestSuiteService,
  userSession: userSessionService,
  webSocketPayload: webSocketPayloadService,
  webSocketRequest: webSocketRequestService,
  webSocketResponse: webSocketResponseService,
  workspace: workspaceService,
  workspaceMeta: workspaceMetaService,
  helpers,
} satisfies Record<string, Record<string, (...args: never[]) => Promise<unknown>>>;
