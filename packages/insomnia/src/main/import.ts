import path from 'node:path';

import orderedJSON from 'json-order';

import { parseApiSpec, type ParsedApiSpec } from '~/common/api-specs';
import { JSON_ORDER_PREFIX, JSON_ORDER_SEPARATOR } from '~/common/constants';
import { database as db } from '~/common/database';
import {
  type ExportedModel,
  extractErrorMessages,
  isApiSpecImport,
  mcpUrlToInsomniaV5Yaml,
  MODELS_BY_EXPORT_TYPE,
  type ScanResult,
} from '~/common/import';
import { IMPORT_SOURCE_TYPES, type ImportSourceType } from '~/common/import-source';
import { tryImportV5Data } from '~/common/insomnia-v5';
import { generateId } from '~/common/misc';
import type { ApiSpec, Environment, EnvironmentKvPairData, Request, Workspace } from '~/insomnia-data';
import { services } from '~/insomnia-data';
import { convert, type InsomniaImporter } from '~/main/importers/convert';
import type { ImportEntry } from '~/main/importers/entities';
import { pathWithParamsAsPathParameters } from '~/main/importers/importers/openapi-3';
import { id as postmanEnvImporterId } from '~/main/importers/importers/postman-env';
import extractPostmanDataDumpHandler from '~/main/ipc/extract-postman-data-dump';
import { insecureReadFile } from '~/main/secure-read-file';
import * as models from '~/models';
import { type BaseModel, getModel } from '~/models';
import * as requestOperations from '~/models/helpers/request-operations';
import { invariant } from '~/utils/invariant';

export interface ImportScanInputData {
  source: ImportSourceType;
  uri?: string;
  curl?: string;
  mcp?: string;
  filePaths?: string | string[];
  postmanArchiveFile?: string | null;
  clipboardText?: string;
}

export interface ImportScannedResourcesParams {
  organizationId: string;
  projectId: string;
  workspaceId?: string;
  endpoint?: string;
  operationId?: string;
  skipImportIfDuplicate?: boolean;
  options?: {
    overrideBaseEnvironmentData?: boolean;
  };
}

export interface ImportScannedResourcesResult {
  done?: true;
  singleImportedWorkspace?: Workspace;
  singleImportedRequest?: Awaited<ReturnType<typeof requestOperations.findByParentId>>[number];
  singleImportedProjectId?: string;
  errors?: string[];
}

interface ConvertResult {
  type: InsomniaImporter;
  data: {
    resources: ExportedModel[];
  };
}

export interface PostmanDataDumpRawData {
  collectionList: ImportEntry[];
  envList: ImportEntry[];
}

interface ResourceCacheType {
  content: string;
  resources: BaseModel[];
  importer: InsomniaImporter;
}

const { isRequest } = models.request;
const { isApiSpec } = models.apiSpec;
const { isRequestGroup } = models.requestGroup;

let resourceCacheList: ResourceCacheType[] = [];

const isSubEnvironmentResource = (environment: Environment) => {
  return (
    !environment.parentId ||
    environment.parentId.startsWith(models.environment.prefix) ||
    environment.parentId.startsWith('__BASE_ENVIRONMENT_ID__')
  );
};

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
    return insecureReadFile(path);
  }

  return decodeURIComponent(uri);
}

export async function getFilesFromPostmanExportedDataDump(filePath: string): Promise<PostmanDataDumpRawData> {
  let res;
  try {
    res = await extractPostmanDataDumpHandler(undefined, filePath);
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

export function clearResourceCache() {
  resourceCacheList = [];
}

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

        result =
          insomnia5Import.length > 0
            ? {
                type: {
                  id: 'insomnia-5',
                  name: 'Insomnia v5',
                  description: 'Insomnia v5',
                },
                data: {
                  resources: insomnia5Import,
                },
              }
            : ((await convert(importEntry)) as unknown as ConvertResult);
      } catch (err: unknown) {
        if (v5Error) {
          const messages = extractErrorMessages(v5Error);
          if (messages.length) {
            return {
              oriFileName,
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

export const scanImportResources = async (data: ImportScanInputData): Promise<ScanResult[]> => {
  const { source, postmanArchiveFile, clipboardText } = data;
  const isZipFilePath = (filePath: string) => filePath.toLowerCase().endsWith('.zip');

  invariant(typeof source === 'string', 'Source is required.');
  invariant(IMPORT_SOURCE_TYPES.includes(source), 'Unsupported import type');

  const contentList: ImportEntry[] = [];

  if (source === 'uri') {
    const { uri } = data;
    invariant(typeof uri === 'string' && uri.length, 'URI is required');
    contentList.push({
      contentStr: await fetchImportContentFromURI({ uri }),
      oriFileName: uri,
    });
  } else if (source === 'curl') {
    const { curl } = data;
    invariant(typeof curl === 'string' && curl.length, 'cURL command is required');
    contentList.push({
      contentStr: curl,
    });
  } else if (source === 'mcp') {
    const { mcp } = data;
    invariant(typeof mcp === 'string' && mcp.length, 'MCP server URL is required');
    const importYaml = mcpUrlToInsomniaV5Yaml(mcp);
    invariant(importYaml, 'Failed to convert MCP URL to Insomnia v5 YAML');
    contentList.push({
      contentStr: importYaml,
      oriFileName: 'mcp',
    });
  } else if (source === 'file') {
    let filePaths: string[];
    try {
      filePaths = typeof data.filePaths === 'string' ? JSON.parse(data.filePaths) : data.filePaths;
      if (!Array.isArray(filePaths)) {
        throw new TypeError('filePaths is not an array');
      }
      filePaths = filePaths.filter(filePath => typeof filePath === 'string' && filePath);
      if (filePaths.length === 0) {
        throw new Error('filePaths is empty');
      }
    } catch {
      throw new Error('File is required');
    }

    const zipFilePaths = filePaths.filter(isZipFilePath);
    const nonZipFilePaths = filePaths.filter(filePath => !isZipFilePath(filePath));

    for (const zipFilePath of zipFilePaths) {
      const postmanDataDumpRawData = await getFilesFromPostmanExportedDataDump(zipFilePath);
      const zipBaseName = path.basename(zipFilePath);

      const trans = ({ contentStr, oriFileName }: ImportEntry): ImportEntry => ({
        contentStr,
        oriFileName: `${oriFileName} in ${zipBaseName}`,
      });

      contentList.push(
        ...postmanDataDumpRawData.collectionList.map(trans),
        ...postmanDataDumpRawData.envList.map(trans),
      );
    }

    let postmanArchiveJsonData: { environment?: Record<string, boolean> } | null = null;
    if (postmanArchiveFile) {
      try {
        const postmanArchiveFileContent = await fetchImportContentFromURI({
          uri: `file://${postmanArchiveFile}`,
        });
        postmanArchiveJsonData = JSON.parse(postmanArchiveFileContent);
      } catch {
        return [
          {
            oriFileName: postmanArchiveFile,
            errors: ['Failed to parse archive.json file'],
          },
        ];
      }
    }

    for (const filePath of nonZipFilePaths) {
      const uri = `file://${filePath}`;
      let contentStr = await fetchImportContentFromURI({ uri });

      if (postmanArchiveJsonData) {
        try {
          const jsonData = JSON.parse(contentStr);
          if (postmanArchiveJsonData.environment?.[jsonData.id]) {
            jsonData._postman_variable_scope = 'environment';
            contentStr = JSON.stringify(jsonData);
          }
        } catch {
          // It's not valid JSON, so it cannot be a postman environment marker candidate.
        }
      }

      contentList.push({
        contentStr,
        oriFileName: path.basename(filePath),
        oriFilePath: filePath,
      });
    }
  } else {
    contentList.push({
      contentStr: clipboardText || '',
      oriFileName: 'clipboard',
    });
  }

  if (contentList.length === 0) {
    throw new Error('No content to import');
  }

  return scanResources(contentList);
};

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

    if (importer.id === postmanEnvImporterId && resources.find(models.environment.isEnvironment)) {
      const newWorkspaces = await Promise.all(
        resources.filter(models.environment.isEnvironment).map(resource =>
          importResourcesToNewWorkspace({
            projectId,
            resourceCacheItem,
            workspaceToImport: {
              name: resource.name,
              scope: 'environment',
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
    if (workspaceResources.length === 0) {
      const newWorkspace = await importResourcesToNewWorkspace({
        projectId,
        resourceCacheItem,
        syncNewWorkspaceIfNeeded,
      });
      importedWorkspaces.push(newWorkspace);
      continue;
    }

    const newWorkspaces = await Promise.all(
      workspaceResources.map(workspace => {
        if (workspaceResources.filter(({ _id }) => _id === '__WORKSPACE_ID__').length > 1) {
          console.warn(
            `There are more than one workspace with id __WORKSPACE_ID__ in the resources, the importer is ${resourceCacheItem.importer.name}`,
          );
        }

        let resourcesInCurrentWorkspace = resources;
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

function filterResourcesInWorkspace(resources: BaseModel[], workspace: Workspace) {
  const workspaceId = workspace._id;
  const idToParentIdMap = new Map<string, string>();
  resources.forEach(resource => {
    if (resource.parentId && resource._id !== resource.parentId) {
      idToParentIdMap.set(resource._id, resource.parentId);
    }
  });

  function findRootId(id: string, existingResourceIds: Set<string>) {
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
            const originValue = originalEnvironmentData[key];
            const index = newKvPairs.findIndex(pair => pair.name === key && pair.value === originValue);
            newKvPairs[index] = {
              ...newKvPairs[index],
              value: newData[key],
            };
          } else {
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

    for (const resource of optionalResources) {
      const model = getModel(resource.type);
      model && ResourceIdMap.set(resource._id, generateId(model.prefix));
    }

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

  await services.environment.getOrCreateForParentId(newWorkspace._id);
  const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(newWorkspace._id);

  if (models.project.isGitProject(project)) {
    await services.workspaceMeta.update(workspaceMeta, {
      gitFilePath: `${newWorkspace.name}-${newWorkspace._id}.yaml`,
    });
  }
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

export const importScannedResources = async ({
  organizationId,
  projectId,
  workspaceId,
  endpoint,
  operationId,
  skipImportIfDuplicate,
  options,
}: ImportScannedResourcesParams): Promise<ImportScannedResourcesResult> => {
  invariant(organizationId && typeof organizationId === 'string', 'OrganizationId is required.');
  invariant(projectId && typeof projectId === 'string', 'ProjectId is required.');

  const project = await services.project.getById(projectId);
  invariant(project, 'Project not found.');

  if (!workspaceId && skipImportIfDuplicate) {
    const existing = await findExistingImportedSpec(projectId, organizationId);
    if (existing) {
      const matchedRequest = await findRequestInExistingWorkspace(existing.workspace, endpoint, operationId);
      clearResourceCache();
      return {
        done: true,
        singleImportedWorkspace: existing.workspace,
        singleImportedRequest: matchedRequest,
        singleImportedProjectId: existing.workspace.parentId,
      };
    }
  }

  const importedWorkspaces = await (typeof workspaceId === 'string' && workspaceId
    ? importResourcesToWorkspace({
        workspaceId,
        overrideBaseEnvironmentData: options?.overrideBaseEnvironmentData ?? true,
      })
    : importResourcesToProject({
        projectId: project._id,
      }));

  if (endpoint || operationId) {
    for (const ws of importedWorkspaces) {
      if (!ws) {
        continue;
      }

      const foundDeepLinkedRequest = await findRequestInExistingWorkspace(ws, endpoint, operationId);
      if (foundDeepLinkedRequest) {
        return {
          done: true,
          singleImportedWorkspace: ws,
          singleImportedRequest: foundDeepLinkedRequest,
        };
      }
    }
  }

  const singleImportedWorkspace =
    Array.isArray(importedWorkspaces) && importedWorkspaces.length === 1 ? importedWorkspaces[0] : undefined;
  const requests = singleImportedWorkspace && (await requestOperations.findByParentId(singleImportedWorkspace._id));
  const singleImportedRequest = Array.isArray(requests) && requests.length === 1 ? requests[0] : undefined;

  return {
    done: true,
    singleImportedWorkspace,
    singleImportedRequest,
  };
};
