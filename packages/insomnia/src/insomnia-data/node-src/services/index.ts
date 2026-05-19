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
import * as helpersService from './helpers';
import * as mcpPayloadService from './mcp-payload';
import * as mcpRequestService from './mcp-request';
import * as mcpResponseService from './mcp-response';
import * as mockRouteService from './mock-route';
import * as mockServerService from './mock-server';
import * as oAuth2TokenService from './o-auth-2-token';
import * as organizationService from './organization';
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
import * as socketIORequestMetaService from './socket-io-request-meta';
import * as socketIOResponseService from './socket-io-response';
import * as statsService from './stats';
import * as unitTestService from './unit-test';
import * as unitTestResultService from './unit-test-result';
import * as unitTestSuiteService from './unit-test-suite';
import * as userSessionService from './user-session';
import * as webSocketPayloadService from './websocket-payload';
import * as webSocketRequestService from './websocket-request';
import * as webSocketRequestMetaService from './websocket-request-meta';
import * as webSocketResponseService from './websocket-response';
import * as workspaceService from './workspace';
import * as workspaceMetaService from './workspace-meta';

// Services are consumed from renderer via preload -> IPC (`ipcRenderer.invoke`), so this contract
// must stay async across runtimes even if a main-process implementation could be synchronous.
// `satisfies` keeps the original inferred type while still producing compile-time errors for sync actions.
export const servicesNodeImpl = {
  apiSpec: apiSpecService,
  caCertificate: caCertificateService,
  clientCertificate: clientCertificateService,
  cloudCredential: cloudCredentialService,
  gitCredentials: gitCredentialsService,
  gitRepository: gitRepositoryService,
  mcpPayload: mcpPayloadService,
  cookieJar: cookieJarService,
  environment: environmentService,
  mcpRequest: mcpRequestService,
  mcpResponse: mcpResponseService,
  oAuth2Token: oAuth2TokenService,
  organization: organizationService,
  pluginData: pluginDataService,
  protoDirectory: protoDirectoryService,
  protoFile: protoFileService,
  request: requestService,
  requestGroup: requestGroupService,
  requestGroupMeta: requestGroupMetaService,
  requestMeta: requestMetaService,
  requestVersion: requestVersionService,
  response: responseService,
  runnerTestResult: runnerTestResultService,
  project: projectService,
  settings: settingsService,
  stats: statsService,
  userSession: userSessionService,
  grpcRequest: grpcRequestService,
  grpcRequestMeta: grpcRequestMetaService,
  workspace: workspaceService,
  workspaceMeta: workspaceMetaService,
  mockRoute: mockRouteService,
  mockServer: mockServerService,
  unitTest: unitTestService,
  unitTestResult: unitTestResultService,
  unitTestSuite: unitTestSuiteService,
  socketIOPayload: socketIOPayloadService,
  socketIORequest: socketIORequestService,
  socketIORequestMeta: socketIORequestMetaService,
  socketIOResponse: socketIOResponseService,
  webSocketPayload: webSocketPayloadService,
  webSocketRequest: webSocketRequestService,
  webSocketRequestMeta: webSocketRequestMetaService,
  webSocketResponse: webSocketResponseService,
  helpers: helpersService,
} satisfies Record<string, Record<string, (...args: never[]) => Promise<unknown>>>;
