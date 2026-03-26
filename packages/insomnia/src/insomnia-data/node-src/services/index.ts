import * as apiSpecService from './api-spec';
import * as caCertificateService from './ca-certificate';
import * as clientCertificateService from './client-certificate';
import * as cloudCredentialService from './cloud-credential';
import * as cookieJarService from './cookie-jar';
import * as environmentService from './environment';
import * as gitCredentialsService from './git-credentials';
import * as gitRepositoryService from './git-repository';
import * as mcpPayloadService from './mcp-payload';
import * as mcpRequestService from './mcp-request';
import * as mcpResponseService from './mcp-response';
import * as oAuth2TokenService from './o-auth-2-token';
import * as pluginDataService from './plugin-data';
import * as projectService from './project';
import * as protoDirectoryService from './proto-directory';
import * as protoFileService from './proto-file';
import * as runnerTestResultService from './runner-test-result';
import * as settingsService from './settings';
import * as statsService from './stats';
import * as unitTestService from './unit-test';
import * as unitTestResultService from './unit-test-result';
import * as unitTestSuiteService from './unit-test-suite';
import * as userSessionService from './user-session';

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
  pluginData: pluginDataService,
  protoDirectory: protoDirectoryService,
  protoFile: protoFileService,
  runnerTestResult: runnerTestResultService,
  project: projectService,
  settings: settingsService,
  stats: statsService,
  userSession: userSessionService,
  unitTest: unitTestService,
  unitTestResult: unitTestResultService,
  unitTestSuite: unitTestSuiteService,
} satisfies Record<string, Record<string, (...args: never[]) => Promise<unknown>>>;
