import type { AllTypes, BaseModel } from './base-types';
import * as dbModels from './db-models';

// models - export models that define the structure of the data and any related functions such as init, type guards
export * from './db-models';

export * as organization from './organization';

// Type assertion to ensure dbModels has the expected structure
dbModels satisfies Record<
  string,
  {
    type: string;
    name: string;
    prefix: string;
    optionalKeys?: string[];
    canDuplicate: boolean;
    canSync?: boolean;
    init: () => unknown;
    rewriteReferences?: (doc: any, idMapping: Map<string, string>) => any;
  }
>;

export const all = () => Object.values(dbModels);

export const types = () => all().map(model => model.type);

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

// Use function instead of object to avoid issues with circular dependencies
export const getAllDescendantMap = (): Partial<Record<AllTypes, AllTypes[]>> => {
  return {
    [dbModels.project.type]: [dbModels.workspace.type],
    [dbModels.workspace.type]: [
      dbModels.requestGroup.type,
      dbModels.request.type,
      dbModels.grpcRequest.type,
      dbModels.webSocketRequest.type,
      dbModels.socketIORequest.type,
      dbModels.cookieJar.type,
      dbModels.environment.type,
      dbModels.apiSpec.type,
      dbModels.mockServer.type,
      dbModels.unitTestSuite.type,
      dbModels.protoDirectory.type,
      dbModels.protoFile.type,
      dbModels.workspaceMeta.type,
      dbModels.runnerTestResult.type,
      dbModels.caCertificate.type,
      dbModels.clientCertificate.type,
      dbModels.mcpRequest.type,
    ],
    [dbModels.requestGroup.type]: [
      dbModels.requestGroup.type,
      dbModels.request.type,
      dbModels.grpcRequest.type,
      dbModels.webSocketRequest.type,
      dbModels.socketIORequest.type,
      dbModels.runnerTestResult.type,
      dbModels.requestGroupMeta.type,
      dbModels.oAuth2Token.type,
    ],
    [dbModels.request.type]: [
      dbModels.requestMeta.type,
      dbModels.response.type,
      dbModels.requestVersion.type,
      dbModels.oAuth2Token.type,
    ],
    [dbModels.grpcRequest.type]: [dbModels.grpcRequestMeta.type],
    [dbModels.webSocketRequest.type]: [
      dbModels.webSocketPayload.type,
      dbModels.webSocketResponse.type,
      dbModels.requestMeta.type,
    ],
    [dbModels.socketIORequest.type]: [
      dbModels.socketIOPayload.type,
      dbModels.socketIOResponse.type,
      dbModels.requestMeta.type,
    ],
    [dbModels.mcpRequest.type]: [dbModels.mcpPayload.type, dbModels.mcpResponse.type],
    [dbModels.mockServer.type]: [dbModels.mockRoute.type],
    [dbModels.environment.type]: [dbModels.environment.type],
    [dbModels.unitTestSuite.type]: [dbModels.unitTest.type, dbModels.unitTestResult.type],
    [dbModels.unitTest.type]: [dbModels.unitTestResult.type],
    [dbModels.protoDirectory.type]: [dbModels.protoDirectory.type, dbModels.protoFile.type],
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
