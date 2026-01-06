import { databaseSchema } from '~/models/schema';
import { legacyMigrations } from '~/models/schema-migrations';
import { invariant } from '~/utils/invariant';

import { generateId } from '../common/misc';
import * as _apiSpec from './api-spec';
import * as _caCertificate from './ca-certificate';
import * as _clientCertificate from './client-certificate';
import * as _cloudCredential from './cloud-credential';
import * as _cookieJar from './cookie-jar';
import * as _environment from './environment';
import * as _gitCredentials from './git-credentials';
import * as _gitRepository from './git-repository';
import * as _grpcRequest from './grpc-request';
import * as _grpcRequestMeta from './grpc-request-meta';
import * as _mcpRequest from './mcp-request';
import * as _mcpPayload from './mcp-request-payload';
import * as _mcpResponse from './mcp-response';
import * as _mockRoute from './mock-route';
import * as _mockServer from './mock-server';
import * as _oAuth2Token from './o-auth-2-token';
import * as _pluginData from './plugin-data';
import * as _project from './project';
import * as _protoDirectory from './proto-directory';
import * as _protoFile from './proto-file';
import * as _request from './request';
import * as _requestGroup from './request-group';
import * as _requestGroupMeta from './request-group-meta';
import * as _requestMeta from './request-meta';
import * as _requestVersion from './request-version';
import * as _response from './response';
import * as _runnerTestResult from './runner-test-result';
import * as _settings from './settings';
import * as _socketIOPayload from './socket-io-payload';
import * as _socketIORequest from './socket-io-request';
import * as _socketIOResponse from './socket-io-response';
import * as _stats from './stats';
import * as _unitTest from './unit-test';
import * as _unitTestResult from './unit-test-result';
import * as _unitTestSuite from './unit-test-suite';
import * as _userSession from './user-session';
import * as _webSocketPayload from './websocket-payload';
import * as _webSocketRequest from './websocket-request';
import * as _webSocketResponse from './websocket-response';
import * as _workspace from './workspace';
import * as _workspaceMeta from './workspace-meta';

export interface BaseModel {
  _id: string;
  type: AllTypes;
  // TSCONVERSION -- parentId is always required for all models, except 4:
  //   - Stats, Settings, and Project, which never have a parentId
  //   - Workspace optionally has a parentId (which will be the id of a Project)
  parentId: string; // or null
  modified: number;
  created: number;
  isPrivate: boolean;
  name: string;
}

// Reference to each model
export const apiSpec = _apiSpec;
export const clientCertificate = _clientCertificate;
export const caCertificate = _caCertificate;
export const cookieJar = _cookieJar;
export const environment = _environment;
export const gitCredentials = _gitCredentials;
export const gitRepository = _gitRepository;
export const mockServer = _mockServer;
export const mockRoute = _mockRoute;
export const oAuth2Token = _oAuth2Token;
export const pluginData = _pluginData;
export const request = _request;
export const requestGroup = _requestGroup;
export const requestGroupMeta = _requestGroupMeta;
export const requestMeta = _requestMeta;
export const requestVersion = _requestVersion;
export const runnerTestResult = _runnerTestResult;
export const response = _response;
export const settings = _settings;
export const project = _project;
export const stats = _stats;
export const unitTest = _unitTest;
export const unitTestSuite = _unitTestSuite;
export const unitTestResult = _unitTestResult;
export const protoFile = _protoFile;
export const protoDirectory = _protoDirectory;
export const grpcRequest = _grpcRequest;
export const grpcRequestMeta = _grpcRequestMeta;
export const webSocketPayload = _webSocketPayload;
export const webSocketRequest = _webSocketRequest;
export const socketIORequest = _socketIORequest;
export const socketIOPayload = _socketIOPayload;
export const socketIOResponse = _socketIOResponse;
export const webSocketResponse = _webSocketResponse;
export const workspace = _workspace;
export const workspaceMeta = _workspaceMeta;
export * as organization from './organization';
export const userSession = _userSession;
export const cloudCredential = _cloudCredential;
export const mcpRequest = _mcpRequest;
export const mcpResponse = _mcpResponse;
export const mcpPayload = _mcpPayload;

export type AllTypes = keyof typeof databaseSchema;

export function canSync(d: BaseModel) {
  if (d.isPrivate) {
    return false;
  }

  const m = getModel(d.type);

  return m.canSync;
}

export function getModel(type: AllTypes) {
  invariant(type, 'Type is required to get model');
  invariant(databaseSchema[type], `Model not found for type "${type}"`);
  return databaseSchema[type];
}

export function canDuplicate(type: AllTypes) {
  const model = getModel(type);
  return model.canDuplicate;
}

export async function initModel<T extends BaseModel>(type: AllTypes, ...sources: Record<string, any>[]): Promise<T> {
  const model = getModel(type);

  // Define global default fields
  const objectDefaults = Object.assign(
    {},
    {
      _id: null,
      type: type,
      parentId: null,
      modified: Date.now(),
      created: Date.now(),
    },
    model.init(),
  );
  const fullObject = Object.assign({}, objectDefaults, ...sources);

  // Generate an _id if there isn't one yet
  if (!fullObject._id) {
    fullObject._id = generateId(model.prefix);
  }

  // Migrate the model
  // NOTE: Do migration before pruning because we might need to look at those fields
  const migratedDoc = legacyMigrations(fullObject);
  // optional keys do not generated in init method but should allow update.
  // If we put those keys in init method, all related models will show as modified in git sync.
  const modelOptionalKeys: string[] = 'optionalKeys' in model ? model.optionalKeys || [] : [];
  // Prune extra keys from doc
  for (const key of Object.keys(migratedDoc)) {
    if (!(key in objectDefaults) && !modelOptionalKeys.includes(key)) {
      delete migratedDoc[key];
    }
  }

  return migratedDoc as T;
}

// Use function instead of object to avoid issues with circular dependencies
export const getAllDescendantMap = (): Partial<Record<AllTypes, AllTypes[]>> => {
  return {
    [databaseSchema.Project.type]: [databaseSchema.Workspace.type],
    [databaseSchema.Workspace.type]: [
      databaseSchema.RequestGroup.type,
      databaseSchema.Request.type,
      databaseSchema.GrpcRequest.type,
      databaseSchema.WebSocketRequest.type,
      databaseSchema.SocketIORequest.type,
      databaseSchema.CookieJar.type,
      databaseSchema.Environment.type,
      databaseSchema.ApiSpec.type,
      databaseSchema.MockServer.type,
      databaseSchema.UnitTestSuite.type,
      databaseSchema.ProtoDirectory.type,
      databaseSchema.ProtoFile.type,
      databaseSchema.WorkspaceMeta.type,
      databaseSchema.RunnerTestResult.type,
      databaseSchema.CaCertificate.type,
      databaseSchema.ClientCertificate.type,
      databaseSchema.McpRequest.type,
    ],
    [databaseSchema.RequestGroup.type]: [
      databaseSchema.RequestGroup.type,
      databaseSchema.Request.type,
      databaseSchema.GrpcRequest.type,
      databaseSchema.WebSocketRequest.type,
      databaseSchema.SocketIORequest.type,
      databaseSchema.RunnerTestResult.type,
      databaseSchema.RequestGroupMeta.type,
      databaseSchema.OAuth2Token.type,
    ],
    [databaseSchema.Request.type]: [
      databaseSchema.RequestMeta.type,
      databaseSchema.Response.type,
      databaseSchema.RequestVersion.type,
      databaseSchema.OAuth2Token.type,
    ],
    [databaseSchema.GrpcRequest.type]: [databaseSchema.GrpcRequestMeta.type],
    [databaseSchema.WebSocketRequest.type]: [
      databaseSchema.WebSocketPayload.type,
      databaseSchema.WebSocketResponse.type,
      databaseSchema.RequestMeta.type,
    ],
    [databaseSchema.SocketIORequest.type]: [
      databaseSchema.SocketIOPayload.type,
      databaseSchema.SocketIOResponse.type,
      databaseSchema.RequestMeta.type,
    ],
    [databaseSchema.McpRequest.type]: [databaseSchema.McpPayload.type, databaseSchema.McpResponse.type],
    [databaseSchema.MockServer.type]: [databaseSchema.MockRoute.type],
    [databaseSchema.Environment.type]: [databaseSchema.Environment.type],
    [databaseSchema.UnitTestSuite.type]: [databaseSchema.UnitTest.type, databaseSchema.UnitTestResult.type],
    [databaseSchema.UnitTest.type]: [databaseSchema.UnitTestResult.type],
    [databaseSchema.ProtoDirectory.type]: [databaseSchema.ProtoDirectory.type, databaseSchema.ProtoFile.type],
  };
};

let childToParentMap: Partial<Record<AllTypes, AllTypes[]>> | undefined;

const getChildToParentMap = () => {
  if (childToParentMap) {
    return childToParentMap;
  }
  const childToParents: Partial<Record<AllTypes, AllTypes[]>> = {};
  for (const [parent, children] of Object.entries(getAllDescendantMap())) {
    for (const child of children) {
      if (!childToParents[child]) childToParents[child] = [];
      childToParents[child].push(parent as AllTypes);
    }
  }
  childToParentMap = childToParents;
  return childToParents;
};

export const generateDescendantMap = (queryTypes: AllTypes[]): Partial<Record<AllTypes, AllTypes[]>> => {
  const result: Partial<Record<AllTypes, AllTypes[]>> = {};

  const visited = new Set<string>();
  const collectAncestors = (child: AllTypes) => {
    if (!child || visited.has(child)) {
      return;
    }
    visited.add(child);
    const parentMap = getChildToParentMap();
    const parents = parentMap[child];
    if (parents?.length) {
      for (const p of parents) {
        if (!result[p]) {
          result[p] = [];
        }
        result[p].push(child);
        collectAncestors(p);
      }
    }
  };

  for (const type of queryTypes) {
    collectAncestors(type);
  }

  return result;
};
