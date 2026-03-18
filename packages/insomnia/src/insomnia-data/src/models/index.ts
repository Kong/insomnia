// model types — flat re-exports for convenient consumer access, only export types that are needed outside of this package

import { generateId } from '~/common/misc';
import { typedKeys } from '~/utils';

// models - export models that define the structure of the data and any related functions such as init, type guards
import * as apiSpec from './api-spec';
import * as caCertificate from './ca-certificate';
import * as clientCertificate from './client-certificate';
import * as cloudCredential from './cloud-credential';
import * as cookieJar from './cookie-jar';
import * as environment from './environment';
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
import * as organization from './organization';
import * as pluginData from './plugin-data';
import * as project from './project';
import * as protoDirectory from './proto-directory';
import * as protoFile from './proto-file';
import * as request from './request';
import * as requestGroup from './request-group';
import * as requestGroupMeta from './request-group-meta';
import * as requestMeta from './request-meta';
import * as requestVersion from './request-version';
import * as response from './response';
import * as runnerTestResult from './runner-test-result';
import * as settings from './settings';
import * as socketIOPayload from './socket-io-payload';
import * as socketIORequest from './socket-io-request';
import * as socketIOResponse from './socket-io-response';
import * as stats from './stats';
import { type AllTypes, type BaseModel } from './types';
import * as unitTest from './unit-test';
import * as unitTestResult from './unit-test-result';
import * as unitTestSuite from './unit-test-suite';
import * as userSession from './user-session';
import * as webSocketPayload from './websocket-payload';
import * as webSocketRequest from './websocket-request';
import * as webSocketResponse from './websocket-response';
import * as workspace from './workspace';
import * as workspaceMeta from './workspace-meta';

const dbModels = {
  apiSpec,
  caCertificate,
  clientCertificate,
  cloudCredential,
  cookieJar,
  environment,
  gitCredentials,
  gitRepository,
  grpcRequest,
  grpcRequestMeta,
  mcpPayload,
  mcpRequest,
  mcpResponse,
  mockRoute,
  mockServer,
  oAuth2Token,
  pluginData,
  project,
  protoDirectory,
  protoFile,
  requestGroup,
  requestGroupMeta,
  requestMeta,
  requestVersion,
  request,
  response,
  runnerTestResult,
  settings,
  socketIOPayload,
  socketIORequest,
  socketIOResponse,
  stats,
  unitTestResult,
  unitTestSuite,
  unitTest,
  userSession,
  webSocketPayload,
  webSocketRequest,
  webSocketResponse,
  workspaceMeta,
  workspace,
} as const;

const all = () => Object.values(dbModels);

const types = () => all().map(model => model.type);

const isValidType = (type: string): type is AllTypes => {
  return types().includes(type as AllTypes);
};
function canSync(d: BaseModel) {
  if (d.isPrivate) {
    return false;
  }

  const m = getModel(d.type);

  if (!m) {
    return false;
  }

  return m.canSync || false;
}

function getModel(type: string) {
  return all().find(m => m.type === type) || null;
}

function mustGetModel(type: string) {
  const model = getModel(type);

  if (!model) {
    throw new Error(`The model type ${type} must exist but could not be found.`);
  }

  return model;
}

function canDuplicate(type: string) {
  const model = getModel(type);
  return model ? model.canDuplicate : false;
}

function rewriteReferences<T extends BaseModel>(doc: T, idMapping: Map<string, string>): T {
  const model = getModel(doc.type);
  if (!model) return doc;
  return 'rewriteReferences' in model
    ? (model.rewriteReferences as unknown as (doc: T, idMapping: Map<string, string>) => T)(doc, idMapping)
    : doc;
}

async function initModel<T extends BaseModel>(type: string, ...sources: Record<string, any>[]): Promise<T> {
  const model = getModel(type);

  if (!model) {
    const choices = all()
      .map(m => m.type)
      .join(', ');
    throw new Error(`Tried to init invalid model "${type}". Choices are ${choices}`);
  }

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
  const migratedDoc = ('migrate' in model ? model.migrate : (doc: T) => doc)(fullObject);
  // optional keys do not generated in init method but should allow update.
  // If we put those keys in init method, all related models will show as modified in git sync.
  const modelOptionalKeys: string[] = 'optionalKeys' in model ? model.optionalKeys || [] : [];
  // Prune extra keys from doc
  for (const key of typedKeys(migratedDoc)) {
    if (!(key in objectDefaults) && !modelOptionalKeys.includes(key)) {
      delete migratedDoc[key];
    }
  }

  return migratedDoc as T;
}

// Use function instead of object to avoid issues with circular dependencies
const getAllDescendantMap = (): Partial<Record<AllTypes, AllTypes[]>> => {
  return {
    [project.type]: [workspace.type],
    [workspace.type]: [
      requestGroup.type,
      request.type,
      grpcRequest.type,
      webSocketRequest.type,
      socketIORequest.type,
      cookieJar.type,
      environment.type,
      apiSpec.type,
      mockServer.type,
      unitTestSuite.type,
      protoDirectory.type,
      protoFile.type,
      workspaceMeta.type,
      runnerTestResult.type,
      caCertificate.type,
      clientCertificate.type,
      mcpRequest.type,
    ],
    [requestGroup.type]: [
      requestGroup.type,
      request.type,
      grpcRequest.type,
      webSocketRequest.type,
      socketIORequest.type,
      runnerTestResult.type,
      requestGroupMeta.type,
      oAuth2Token.type,
    ],
    [request.type]: [requestMeta.type, response.type, requestVersion.type, oAuth2Token.type],
    [grpcRequest.type]: [grpcRequestMeta.type],
    [webSocketRequest.type]: [webSocketPayload.type, webSocketResponse.type, requestMeta.type],
    [socketIORequest.type]: [socketIOPayload.type, socketIOResponse.type, requestMeta.type],
    [mcpRequest.type]: [mcpPayload.type, mcpResponse.type],
    [mockServer.type]: [mockRoute.type],
    [environment.type]: [environment.type],
    [unitTestSuite.type]: [unitTest.type, unitTestResult.type],
    [unitTest.type]: [unitTestResult.type],
    [protoDirectory.type]: [protoDirectory.type, protoFile.type],
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

const generateDescendantMap = (queryTypes: AllTypes[]): Partial<Record<AllTypes, AllTypes[]>> => {
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

export const models = {
  ...dbModels,
  organization,
  all,
  types,
  isValidType,
  canSync,
  getModel,
  mustGetModel,
  canDuplicate,
  initModel,
  generateDescendantMap,
  getAllDescendantMap,
  rewriteReferences,
} as const;
