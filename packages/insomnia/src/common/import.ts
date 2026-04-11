import orderedJSON from 'json-order';
import { z, type ZodError } from 'zod/v4';

import type {
  ApiSpec,
  CookieJar,
  Environment,
  EnvironmentKvPairData,
  GrpcRequest,
  McpRequest,
  MockRoute,
  Request,
  SocketIORequest,
  UnitTest,
  UnitTestSuite,
  WebSocketRequest,
  Workspace,
} from '~/insomnia-data';
import { services } from '~/insomnia-data';
import { insecureReadFile } from '~/main/secure-read-file';

import type { InsomniaImporter } from '../main/importers/convert';
import type { ImportEntry } from '../main/importers/entities';
import { pathWithParamsAsPathParameters } from '../main/importers/importers/openapi-3';
import { id as postmanEnvImporterId } from '../main/importers/importers/postman-env';
import * as models from '../models/index';
import { type AllTypes, type BaseModel, getModel } from '../models/index';
import { invariant } from '../utils/invariant';
import { parseApiSpec, type ParsedApiSpec } from './api-specs';
import { JSON_ORDER_PREFIX, JSON_ORDER_SEPARATOR } from './constants';
import { database as db } from './database';
import { tryImportV5Data } from './insomnia-v5';
import { generateId } from './misc';

const { isRequest } = models.request;
const { isApiSpec } = models.apiSpec;
const { isRequestGroup } = models.requestGroup;

export const IMPORT_SOURCE_TYPES = ['file', 'uri', 'curl', 'clipboard', 'mcp'] as const;
export type ImportSourceType = (typeof IMPORT_SOURCE_TYPES)[number];

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
export interface ExportedModel extends BaseModel {
  _type: AllExportTypes;
}

interface ConvertResult {
  type: InsomniaImporter;
  data: {
    resources: ExportedModel[];
  };
}

const isSubEnvironmentResource = (environment: Environment) => {
  return (
    !environment.parentId ||
    environment.parentId.startsWith(models.environment.prefix) ||
    environment.parentId.startsWith('__BASE_ENVIRONMENT_ID__')
  );
};

export const isInsomniaV4Import = ({ id }: Pick<InsomniaImporter, 'id'>) => id === 'insomnia-4';

export async function fetchImportContentFromURI({ uri }: { uri: string }) {
  const url = new URL(uri);

  if (url.origin === 'https://github.com') {
    uri = uri.replace('https://github.com', 'https://raw.githubusercontent.com').replace('blob/', '');
  }

  if (uri.match(/^(http|https):\/\//)) {
    const response = await fetch(uri);
    const content = await response.text();

    return content;
  } else if (uri.match(/^(file):\/\//)) {
    const path = uri.replace(/^(file):\/\//, '');
    // allow reading the file as it is chosen by user
    return insecureReadFile(path);
  }
  // Treat everything else as raw text
  const content = decodeURIComponent(uri);

  return content;
}

export interface PostmanDataDumpRawData {
  collectionList: ImportEntry[];
  envList: ImportEntry[];
}

export async function getFilesFromPostmanExportedDataDump(filePath: string): Promise<PostmanDataDumpRawData> {
  let res;
  try {
    res = await window.main.extractJsonFileFromPostmanDataDumpArchive(filePath);
  } catch {
    throw new Error('Extract failed');
  }
  if (res && res.data) {
    return res.data;
  } else if (res?.err) {
    throw new Error(res.err);
  } else {
    throw new Error('Extract failed');
  }
}

export interface ScanResult {
  requests?: (Request | WebSocketRequest | GrpcRequest | SocketIORequest)[];
  workspaces?: Workspace[];
  environments?: Environment[];
  apiSpecs?: ApiSpec[];
  cookieJars?: CookieJar[];
  unitTests?: UnitTest[];
  unitTestSuites?: UnitTestSuite[];
  mockRoutes?: MockRoute[];
  mcpRequests?: McpRequest[];
  type?: InsomniaImporter;
  oriFileName?: string;
  errors: string[];
}

interface ResourceCacheType {
  content: string;
  resources: BaseModel[];
  importer: InsomniaImporter;
}

let resourceCacheList: ResourceCacheType[] = [];

export function clearResourceCache() {
  resourceCacheList = [];
}

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

export { mcpUrlToInsomniaV5Yaml } from './insomnia-v5';

export async function scanResources(importEntries: ImportEntry[]): Promise<ScanResult[]> {
  const sessionCache: ResourceCacheType[] = [];
  resourceCacheList = sessionCache;
  const results = await Promise.allSettled(
    importEntries.map(async importEntry => {
      const contentStr = importEntry.contentStr;
      const oriFileName = importEntry.oriFileName || '';

      let result: ConvertResult | null = null;
      let v5Error = null;

      try {
        let insomnia5Import: ExportedModel[] = [];
        if (contentStr.startsWith('type: ')) {
          const { data, error } = tryImportV5Data(contentStr);
          insomnia5Import = data as ExportedModel[];
          v5Error = error;
        }
        if (insomnia5Import.length > 0) {
          result = {
            type: {
              id: 'insomnia-5',
              name: 'Insomnia v5',
              description: 'Insomnia v5',
            },
            data: {
              resources: insomnia5Import,
            },
          };
        } else {
          const processFork =
            process.type === 'renderer' ? window.main.parseImport : (await import('../main/importers/convert')).convert;
          result = (await processFork(importEntry)) as unknown as ConvertResult;
        }
      } catch (err: unknown) {
        if (v5Error) {
          const messages = extractErrorMessages(v5Error);
          if (messages.length) {
            return {
              oriFileName,
              // only report first 5 errors to avoid overflow
              errors: messages.slice(0, 5),
            };
          }
        }
        if (err instanceof Error) {
          return {
            oriFileName,
            errors: [err.message],
          };
        }
      }

      if (!result) {
        return {
          oriFileName,
          errors: ['No resources found to import.'],
        };
      }

      const { type, data } = result;

      const resources = data.resources
        .filter(r => r._type)
        .map(r => {
          const { _type, ...model } = r;
          return { ...model, type: MODELS_BY_EXPORT_TYPE[_type] };
        });

      sessionCache.push({
        resources,
        importer: type,
        content: contentStr,
      });

      const requests = resources.filter(isRequest);
      const requestGroups = resources.filter(isRequestGroup);
      const grpcRequests = resources.filter(models.grpcRequest.isGrpcRequest);
      const environments = resources.filter(models.environment.isEnvironment);
      const unitTests = resources.filter(models.unitTest.isUnitTest);
      const unitTestSuites = resources.filter(models.unitTestSuite.isUnitTestSuite);
      const websocketRequests = resources.filter(models.webSocketRequest.isWebSocketRequest);
      const socketIoRequests = resources.filter(models.socketIORequest.isSocketIORequest);
      const apiSpecs = resources.filter(isApiSpec);
      const workspaces = resources.filter(models.workspace.isWorkspace);
      const cookieJars = resources.filter(models.cookieJar.isCookieJar);
      const mockRoutes = resources.filter(models.mockRoute.isMockRoute);
      const mcpRequests = resources.filter(models.mcpRequest.isMcpRequest);

      return {
        type,
        unitTests,
        unitTestSuites,
        requests: [...requests, ...websocketRequests, ...grpcRequests, ...socketIoRequests],
        requestGroups,
        workspaces,
        environments,
        apiSpecs,
        cookieJars,
        mockRoutes,
        mcpRequests,
        oriFileName,
        errors: [],
      };
    }),
  );
  return results.map(retObj =>
    retObj.status === 'fulfilled'
      ? retObj.value
      : {
          errors: [retObj.reason.toString()],
        },
  );
}

type ZodTreeifiedError = ReturnType<typeof z.treeifyError<any>>;

export function extractErrorMessages(v5Error: ZodError | any): string[] {
  const messages: [string, string[]][] = [];
  function walkError(err: ZodTreeifiedError, path = '') {
    if (err.errors.length > 0) {
      messages.push([path, err.errors]);
    }
    if ('properties' in err) {
      for (const [key, value] of Object.entries(err.properties!)) {
        if (value) {
          walkError(value, path ? `${path}.${key}` : key);
        }
      }
    }
    if ('items' in err) {
      (err.items as (ZodTreeifiedError | undefined)[]).forEach((item, index) => {
        if (item) {
          walkError(item, path ? `${path}.${index}` : String(index));
        }
      });
    }
  }

  if ('issues' in v5Error) {
    const errors = z.treeifyError(v5Error);
    walkError(errors);
    return messages.map(([path, errs]) => `"${path}": ${errs.join('; ')}`);
  }
  return 'message' in v5Error ? [v5Error.message] : typeof v5Error === 'string' ? [v5Error] : [];
}

export async function importResourcesToProject({
  projectId,
  syncNewWorkspaceIfNeeded,
}: {
  projectId: string;
  syncNewWorkspaceIfNeeded?: (workspace: Workspace) => Promise<void>;
}): Promise<Workspace[]> {
  invariant(resourceCacheList.length > 0, 'No resources to import');
  const importedWorkspaces: Workspace[] = [];
  for (const resourceCacheItem of resourceCacheList) {
    const { resources, importer } = resourceCacheItem;
    const bufferId = await db.bufferChanges();

    // if the resource is postman collection
    const postmanTopLevelFolder = resources.find(
      resource => isRequestGroup(resource) && resource.parentId === '__WORKSPACE_ID__',
    ) as Workspace | undefined;
    if (importer.id === 'postman' && postmanTopLevelFolder) {
      const newWorkspace = await importResourcesToNewWorkspace({
        projectId,
        resourceCacheItem,
        workspaceToImport: postmanTopLevelFolder,
        syncNewWorkspaceIfNeeded,
      });
      importedWorkspaces.push(newWorkspace);
      continue;
    }

    // if the resource is postman environment,
    if (importer.id === postmanEnvImporterId && resources.find(models.environment.isEnvironment)) {
      const newWorkspaces = await Promise.all(
        resources.filter(models.environment.isEnvironment).map(resource =>
          importResourcesToNewWorkspace({
            projectId,
            resourceCacheItem,
            workspaceToImport: {
              name: resource.name,
              scope: 'environment',
              // __BASE_ENVIRONMENT_ID__ is the default parentId for environment imported by postman env importer, we use it to indicate the new workspace id
              _id: '__BASE_ENVIRONMENT_ID__',
            } as Workspace,
            syncNewWorkspaceIfNeeded,
          }),
        ),
      );
      importedWorkspaces.push(...newWorkspaces);
      continue;
    }

    const workspaceResources = resources.filter(models.workspace.isWorkspace);

    // No workspace, so create one
    if (workspaceResources.length === 0) {
      const newWorkspace = await importResourcesToNewWorkspace({
        projectId,
        resourceCacheItem,
        syncNewWorkspaceIfNeeded,
      });
      importedWorkspaces.push(newWorkspace);
      continue;
    }

    // One or more workspaces in one resourceCacheItem(A resourceCacheItem corresponds to an import file), filter in the resources that belong to each workspace and then import to new workspaces respectively
    const newWorkspaces = await Promise.all(
      workspaceResources.map(workspace => {
        if (workspaceResources.filter(({ _id }) => _id === '__WORKSPACE_ID__').length > 1) {
          console.warn(
            `There are more than one workspace with id __WORKSPACE_ID__ in the resources, the importer is ${resourceCacheItem.importer.name}`,
          );
        }
        // Here if there is only one workspace in the resources, we import all resources to it
        let resourcesInCurrentWorkspace = resources;
        // If there are more than one workspace in the resources, we filter in the resources that belong to the current workspace
        if (workspaceResources.length > 1) {
          resourcesInCurrentWorkspace = filterResourcesInWorkspace(resources, workspace);
        }
        return importResourcesToNewWorkspace({
          projectId,
          resourceCacheItem: {
            ...resourceCacheItem,
            resources: resourcesInCurrentWorkspace,
          },
          workspaceToImport: workspace,
          syncNewWorkspaceIfNeeded,
        });
      }),
    );
    importedWorkspaces.push(...newWorkspaces);
    await db.flushChanges(bufferId);
  }
  clearResourceCache();
  return importedWorkspaces;
}

// Filter resources that belong to the workspace, including the workspace itself
function filterResourcesInWorkspace(resources: BaseModel[], workspace: Workspace) {
  const workspaceId = workspace._id;
  const idToParentIdMap = new Map<string, string>();
  resources.forEach(resource => {
    // _id is not supposed to be the same as parentId, but who knows, just check it in case
    if (resource.parentId && resource._id !== resource.parentId) {
      idToParentIdMap.set(resource._id, resource.parentId);
    }
  });
  // find the workspace id that the resource belongs to
  function findRootId(id: string, existingResourceIds: Set<string>) {
    // avoid infinite loop
    if (existingResourceIds.has(id)) {
      return id;
    }
    existingResourceIds.add(id);
    const parentId = idToParentIdMap.get(id);
    if (!parentId) {
      return id;
    }
    return findRootId(parentId, existingResourceIds);
  }
  return resources.filter(resource => findRootId(resource._id, new Set()) === workspaceId);
}

export const importResourcesToWorkspace = async ({
  workspaceId,
  overrideBaseEnvironmentData = true,
}: {
  workspaceId: string;
  overrideBaseEnvironmentData?: boolean;
}) => {
  invariant(resourceCacheList.length > 0, 'No resources to import');
  const existingWorkspace = await services.workspace.getById(workspaceId);

  for (const resourceCacheItem of resourceCacheList) {
    const resources = resourceCacheItem.resources;
    const bufferId = await db.bufferChanges();
    const ResourceIdMap = new Map();

    invariant(existingWorkspace, `Could not find workspace with id ${workspaceId}`);
    // Map new IDs
    ResourceIdMap.set(workspaceId, existingWorkspace._id);
    ResourceIdMap.set('__WORKSPACE_ID__', existingWorkspace._id);
    const toImport = resources.find(models.workspace.isWorkspace);
    toImport && ResourceIdMap.set(toImport._id, existingWorkspace._id);

    const optionalResources = resources.filter(
      resource =>
        !models.workspace.isWorkspace(resource) &&
        !isApiSpec(resource) &&
        !models.cookieJar.isCookieJar(resource) &&
        !models.environment.isEnvironment(resource),
    );

    const baseEnvironment = await services.environment.getOrCreateForParentId(workspaceId);
    invariant(baseEnvironment, 'Could not create base environment');

    const baseEnvironmentFromResources = resources
      .filter(models.environment.isEnvironment)
      .find(env => env.parentId && env.parentId.startsWith('__WORKSPACE_ID__'));
    if (baseEnvironmentFromResources) {
      const environmentType = baseEnvironment.environmentType;
      const originalEnvironmentData = baseEnvironment.data || {};
      const baseEnvironmentDataFromResources = baseEnvironmentFromResources.data;
      const newData = overrideBaseEnvironmentData
        ? {
            ...originalEnvironmentData,
            ...baseEnvironmentDataFromResources,
          }
        : {
            ...baseEnvironmentDataFromResources,
            ...originalEnvironmentData,
          };
      const { object, map } = orderedJSON.parse(JSON.stringify(newData), JSON_ORDER_PREFIX, JSON_ORDER_SEPARATOR);
      if (environmentType === 'kv') {
        const originKVPairData = baseEnvironment.kvPairData || [];
        const originKVPairDataNames = originKVPairData.map(pair => pair.name);
        const newKvPairs: EnvironmentKvPairData[] = [...originKVPairData];
        Object.keys(newData).forEach(key => {
          if (originKVPairDataNames.includes(key)) {
            // update existing kv pair value
            const originValue = originalEnvironmentData[key];
            // find the kv pair with the same name and value in case duplicate names with different values exist
            const index = newKvPairs.findIndex(pair => pair.name === key && pair.value === originValue);
            newKvPairs[index] = {
              ...newKvPairs[index],
              value: newData[key],
            };
          } else {
            // Create new kv pair since it does not exist in origin
            newKvPairs.push({
              id: generateId(models.environment.prefixEnvPair),
              name: key,
              value: newData[key],
              type: models.environment.EnvironmentKvPairDataType.STRING,
              enabled: true,
            });
          }
        });
        await services.environment.update(baseEnvironment, {
          kvPairData: newKvPairs,
          data: object,
          dataPropertyOrder: map || null,
        });
      } else {
        await services.environment.update(baseEnvironment, {
          data: object,
          dataPropertyOrder: map || null,
        });
      }
    }
    const subEnvironments = resources.filter(models.environment.isEnvironment).filter(isSubEnvironmentResource) || [];

    for (const environment of subEnvironments) {
      const model = getModel(environment.type);
      model && ResourceIdMap.set(environment._id, generateId(model.prefix));
      await services.environment.create({
        ...environment,
        _id: ResourceIdMap.get(environment._id),
        parentId: baseEnvironment._id,
      });
    }

    // Create new ids for each resource below optionalResources
    for (const resource of optionalResources) {
      const model = getModel(resource.type);
      model && ResourceIdMap.set(resource._id, generateId(model.prefix));
    }

    // Preserve optionalResource relationships
    for (const resource of optionalResources) {
      const model = getModel(resource.type);
      if (model) {
        const rewritten = models.rewriteReferences(resource, ResourceIdMap);
        const objectToWrite = {
          ...rewritten,
          _id: ResourceIdMap.get(resource._id),
          parentId: ResourceIdMap.get(resource.parentId),
        };
        if (models.grpcRequest.isGrpcRequest(resource)) {
          await services.grpcRequest.create(objectToWrite);
        } else if (models.unitTest.isUnitTest(resource)) {
          await services.unitTest.create(objectToWrite);
        } else if (isRequest(resource)) {
          await services.request.create(objectToWrite);
        } else {
          await db.docCreate(model.type, objectToWrite);
        }
      }
    }

    await db.flushChanges(bufferId);
  }
  clearResourceCache();
  return [existingWorkspace];
};

export const isApiSpecImport = ({ id }: Pick<InsomniaImporter, 'id'>) => id === 'openapi3' || id === 'swagger2';

export const importResourcesToNewWorkspace = async ({
  projectId,
  resourceCacheItem,
  workspaceToImport,
  syncNewWorkspaceIfNeeded,
}: {
  projectId: string;
  resourceCacheItem: ResourceCacheType;
  workspaceToImport?: Workspace;
  syncNewWorkspaceIfNeeded?: (workspace: Workspace) => Promise<void>;
}): Promise<Workspace> => {
  invariant(resourceCacheItem, 'No resources to import');

  const project = await services.project.getById(projectId);
  invariant(project, 'Project not found');

  const resources = resourceCacheItem.resources;
  const ResourceIdMap = new Map();
  let newWorkspace: Workspace;
  // support import from both insomnia export and api spec yaml
  if (resources.find(isApiSpec) || isApiSpecImport(resourceCacheItem.importer)) {
    newWorkspace = await services.workspace.create({
      name: workspaceToImport?.name,
      scope: 'design',
      parentId: projectId,
    });

    await services.apiSpec.updateOrCreateForParentId(newWorkspace._id, {
      contents: resourceCacheItem.content as string | undefined,
      contentType: 'yaml',
      fileName: workspaceToImport?.name,
    });
  } else {
    newWorkspace = await services.workspace.create({
      name: workspaceToImport?.name || 'Imported Collection',
      scope: workspaceToImport?.scope || 'collection',
      parentId: projectId,
    });
  }

  // If we're importing into a new workspace
  // Map new IDs
  ResourceIdMap.set('__WORKSPACE_ID__', newWorkspace._id);
  workspaceToImport && ResourceIdMap.set(workspaceToImport._id, newWorkspace._id);

  const resourcesWithoutWorkspaceAndApiSpec = resources.filter(
    resource => !models.workspace.isWorkspace(resource) && !isApiSpec(resource),
  );

  for (const resource of resourcesWithoutWorkspaceAndApiSpec) {
    const model = getModel(resource.type);
    model && ResourceIdMap.set(resource._id, generateId(model.prefix));
  }

  for (const resource of resourcesWithoutWorkspaceAndApiSpec) {
    const model = getModel(resource.type);

    if (model) {
      const newParentId = ResourceIdMap.get(resource.parentId);
      if (!newParentId) {
        console.warn(`Could not find new parent id for ${resource.name} ${resource._id}`);
        continue;
      }
      const rewritten = models.rewriteReferences(resource, ResourceIdMap);
      const objectToWrite = {
        ...rewritten,
        _id: ResourceIdMap.get(resource._id),
        parentId: newParentId,
      };
      if (models.grpcRequest.isGrpcRequest(resource)) {
        await services.grpcRequest.create(objectToWrite);
      } else if (models.unitTest.isUnitTest(resource)) {
        await services.unitTest.create(objectToWrite);
      } else if (isRequest(resource)) {
        await services.request.create(objectToWrite);
      } else {
        await db.docCreate(model.type, objectToWrite);
      }
    }
  }

  // Use the first sub environment as the active one
  const subEnvironments = resources.filter(models.environment.isEnvironment).filter(isSubEnvironmentResource) || [];

  if (subEnvironments.length > 0) {
    const firstSubEnvironment = subEnvironments[0];

    if (firstSubEnvironment) {
      const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(newWorkspace._id);

      await services.workspaceMeta.update(workspaceMeta, {
        activeEnvironmentId: ResourceIdMap.get(firstSubEnvironment._id),
      });
    }
  }

  // Make sure the new workspace has required resources like base environment, cookie jar and workspaceMeta
  await services.environment.getOrCreateForParentId(newWorkspace._id);
  const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(newWorkspace._id);

  if (models.project.isGitProject(project)) {
    await services.workspaceMeta.update(workspaceMeta, {
      gitFilePath: `${newWorkspace.name}-${newWorkspace._id}.yaml`,
    });
  }
  // we sync the new workspace to the cloud in workspaceLoader when user enters the workspace
  // since we won't navigate to the workspace automatically after import
  // here we push to the cloud programmatically
  if (syncNewWorkspaceIfNeeded) {
    await syncNewWorkspaceIfNeeded(newWorkspace);
  }

  return newWorkspace;
};

export function resolveOperationId(operationId: string): { method: string; name: string } | undefined {
  for (const cache of resourceCacheList) {
    let spec: ParsedApiSpec;
    try {
      spec = parseApiSpec(cache.content);
    } catch {
      continue;
    }

    const paths = spec.contents?.paths;
    if (!paths) {
      continue;
    }

    for (const [path, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== 'object') {
        continue;
      }
      for (const [method, operation] of Object.entries(pathItem as Record<string, unknown>)) {
        if (!operation || typeof operation !== 'object') {
          continue;
        }
        if (method.startsWith('x-') || method === 'parameters' || method === '$ref') {
          continue;
        }
        const op = operation as Record<string, unknown>;
        if (op.operationId === operationId) {
          const name: string =
            spec.format === 'swagger'
              ? (op.summary as string | undefined) || `${method} ${path}`
              : (op.summary as string | undefined) || path;
          return { method, name };
        }
      }
    }
  }
  return undefined;
}

function getPathFromRequestUrl(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    const m = url.match(/\}\}(\/.*)$/);
    return m ? m[1] : url;
  }
}

function getOasTitleAndVersion(content: string): { title: string; version: string } | undefined {
  try {
    const spec = parseApiSpec(content);
    const info = spec.contents?.info;
    if (!info || typeof info !== 'object') return undefined;
    const title = info.title;
    const version = info.version;
    if (typeof title !== 'string' || typeof version !== 'string') return undefined;
    return { title, version };
  } catch {
    return undefined;
  }
}

export async function findExistingImportedSpec(
  projectId?: string,
  organizationId?: string,
): Promise<
  | {
      workspace: Workspace;
      apiSpec: ApiSpec;
    }
  | undefined
> {
  const allProjects = await services.project.all();
  const filteredProjects = organizationId ? allProjects.filter(p => p.parentId === organizationId) : allProjects;

  // match active project first, then look in rest
  const projectIds = new Set<string>();
  if (projectId) {
    projectIds.add(projectId);
  }
  for (const p of filteredProjects) {
    projectIds.add(p._id);
  }

  for (const cache of resourceCacheList) {
    if (!isApiSpecImport(cache.importer)) continue;

    const incoming = getOasTitleAndVersion(cache.content);
    if (!incoming) continue;

    for (const pid of projectIds) {
      const workspaces = await services.workspace.findByParentId(pid);
      const designWorkspaces = workspaces.filter(w => w.scope === 'design');

      for (const ws of designWorkspaces) {
        const expectedName = `${incoming.title} ${incoming.version}`;
        if (ws.name !== expectedName) continue;

        const apiSpec = await services.apiSpec.getByParentId(ws._id);
        if (!apiSpec) continue;

        const stored = getOasTitleAndVersion(apiSpec.contents);
        if (!stored || stored.title !== incoming.title || stored.version !== incoming.version) continue;

        return { workspace: ws, apiSpec };
      }
    }
  }
  return undefined;
}

export function pathPatternMatches(pattern: string, concretePath: string): boolean {
  if (!pattern || pattern.length > 200) {
    return false;
  }
  if (pattern === concretePath) {
    return true;
  }
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = concretePath.split('/').filter(Boolean);
  if (patternSegments.length > pathSegments.length) {
    return false;
  }
  const offset = pathSegments.length - patternSegments.length;
  const pathSuffix = pathSegments.slice(offset);
  return patternSegments.every((segment, i) => {
    if (segment.startsWith(':')) {
      return pathSuffix[i].length > 0;
    }
    return segment.toLowerCase() === pathSuffix[i].toLowerCase();
  });
}

export async function findRequestInExistingWorkspace(
  workspace: Workspace,
  endpoint?: string,
  operationId?: string,
): Promise<Request | undefined> {
  const allDocs = await db.getWithDescendants(workspace, [models.request.type]);
  const requests = allDocs.filter(isRequest);
  if (endpoint) {
    const [method, path] = endpoint.split(',', 2);
    if (!method || !path) {
      return undefined;
    }
    const normalizedPath = pathWithParamsAsPathParameters(path);
    return requests.find(
      r =>
        r.method.toUpperCase() === method.toUpperCase() &&
        pathWithParamsAsPathParameters(getPathFromRequestUrl(r.url))
          .toLowerCase()
          .endsWith(normalizedPath.toLowerCase()),
    ) as Request | undefined;
  }
  if (operationId) {
    const opInfo = resolveOperationId(operationId);
    if (!opInfo) return undefined;
    return requests.find(
      r =>
        r.method.toUpperCase() === opInfo.method.toUpperCase() && r.name?.toLowerCase() === opInfo.name.toLowerCase(),
    ) as Request | undefined;
  }
  return undefined;
}
