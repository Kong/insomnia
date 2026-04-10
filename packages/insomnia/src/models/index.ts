import { models } from '~/insomnia-data';
import type { AllTypes, BaseModel } from '~/models/types';

import { generateId } from '../common/misc';
import { typedKeys } from '../utils';

export type { AllTypes, BaseModel };
// Reference to each model
export const apiSpec = models.apiSpec;
export const clientCertificate = models.clientCertificate;
export const caCertificate = models.caCertificate;
export const cookieJar = models.cookieJar;
export const environment = models.environment;
export const gitCredentials = models.gitCredentials;
export const gitRepository = models.gitRepository;
export const oAuth2Token = models.oAuth2Token;
export const pluginData = models.pluginData;
export const mockServer = models.mockServer;
export const mockRoute = models.mockRoute;
export const request = models.request;
export const requestGroup = models.requestGroup;
export const requestGroupMeta = models.requestGroupMeta;
export const requestMeta = models.requestMeta;
export const requestVersion = models.requestVersion;
export const runnerTestResult = models.runnerTestResult;
export const response = models.response;
export const settings = models.settings;
export const project = models.project;
export const stats = models.stats;
export const unitTest = models.unitTest;
export const unitTestSuite = models.unitTestSuite;
export const unitTestResult = models.unitTestResult;
export const protoFile = models.protoFile;
export const protoDirectory = models.protoDirectory;
export const grpcRequest = models.grpcRequest;
export const grpcRequestMeta = models.grpcRequestMeta;
export const workspace = models.workspace;
export const workspaceMeta = models.workspaceMeta;
export const webSocketPayload = models.webSocketPayload;
export const webSocketRequest = models.webSocketRequest;
export const webSocketResponse = models.webSocketResponse;
export const socketIORequest = models.socketIORequest;
export const socketIOPayload = models.socketIOPayload;
export const socketIOResponse = models.socketIOResponse;
export * as organization from './organization';
export const userSession = models.userSession;
export const cloudCredential = models.cloudCredential;
export const mcpRequest = models.mcpRequest;
export const mcpPayload = models.mcpPayload;
export const mcpResponse = models.mcpResponse;

export function all() {
  // NOTE: This list should be from most to least specific (ie. parents above children)
  // For example, stats, settings, project and workspace are global models, with project and workspace being the top-most parents,
  // so they must be at the top
  return [
    stats,
    settings,
    project,
    workspace,
    workspaceMeta,
    environment,
    gitCredentials,
    gitRepository,
    cookieJar,
    apiSpec,
    requestGroup,
    requestGroupMeta,
    request,
    requestVersion,
    requestMeta,
    response,
    mockServer,
    mockRoute,
    oAuth2Token,
    caCertificate,
    clientCertificate,
    pluginData,
    unitTestSuite,
    unitTestResult,
    unitTest,
    protoFile,
    protoDirectory,
    grpcRequest,
    grpcRequestMeta,
    runnerTestResult,
    webSocketPayload,
    webSocketRequest,
    webSocketResponse,
    userSession,
    socketIORequest,
    socketIOPayload,
    socketIOResponse,
    cloudCredential,
    mcpRequest,
    mcpResponse,
    mcpPayload,
  ] as const;
}
export function types() {
  return all().map(model => model.type);
}
export const isValidType = (type: string): type is AllTypes => {
  return types().includes(type as AllTypes);
};
export function canSync(d: BaseModel) {
  if (d.isPrivate) {
    return false;
  }

  const m = getModel(d.type);

  if (!m) {
    return false;
  }

  return m.canSync || false;
}

export function getModel(type: string) {
  return all().find(m => m.type === type) || null;
}

export function mustGetModel(type: string) {
  const model = getModel(type);

  if (!model) {
    throw new Error(`The model type ${type} must exist but could not be found.`);
  }

  return model;
}

export function canDuplicate(type: string) {
  const model = getModel(type);
  return model ? model.canDuplicate : false;
}

export function rewriteReferences<T extends BaseModel>(doc: T, idMapping: Map<string, string>): T {
  const model = getModel(doc.type);
  if (!model) return doc;
  return 'rewriteReferences' in model
    ? (model.rewriteReferences as unknown as (doc: T, idMapping: Map<string, string>) => T)(doc, idMapping)
    : doc;
}

export async function initModel<T extends BaseModel>(type: string, ...sources: Record<string, any>[]): Promise<T> {
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
export const getAllDescendantMap = (): Partial<Record<AllTypes, AllTypes[]>> => {
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
