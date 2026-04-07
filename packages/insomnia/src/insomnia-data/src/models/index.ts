// models - export models that define the structure of the data and any related functions such as init, type guards
import * as apiSpec from './api-spec';
import * as caCertificate from './ca-certificate';
import * as clientCertificate from './client-certificate';
import * as cloudCredential from './cloud-credential';
import * as gitCredentials from './git-credentials';
import * as gitRepository from './git-repository';
import * as grpcRequest from './grpc-request';
import * as grpcRequestMeta from './grpc-request-meta';
import * as mcpPayload from './mcp-payload';
import * as mcpRequest from './mcp-request';
import * as mcpResponse from './mcp-response';
import * as mockRoute from './mock-route';
import * as mockServer from './mock-server';
import * as oAuth2Token from './o-auth-2-token';
import * as pluginData from './plugin-data';
import * as protoDirectory from './proto-directory';
import * as protoFile from './proto-file';
import * as runnerTestResult from './runner-test-result';
import * as settings from './settings';
import * as stats from './stats';
import * as userSession from './user-session';
import * as workspace from './workspace';
import * as workspaceMeta from './workspace-meta';

export const models = {
  apiSpec,
  caCertificate,
  clientCertificate,
  cloudCredential,
  gitCredentials,
  gitRepository,
  mcpPayload,
  mcpRequest,
  mcpResponse,
  oAuth2Token,
  pluginData,
  protoDirectory,
  protoFile,
  runnerTestResult,
  settings,
  stats,
  userSession,
  grpcRequest,
  grpcRequestMeta,
  workspace,
  workspaceMeta,
  mockRoute,
  mockServer,
} as const;
