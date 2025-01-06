import { readFile } from 'fs/promises';

import { type ApiSpec, isApiSpec } from '../models/api-spec';
import { type CookieJar, isCookieJar } from '../models/cookie-jar';
import { type BaseEnvironment, type Environment, isEnvironment } from '../models/environment';
import { type GrpcRequest, isGrpcRequest } from '../models/grpc-request';
import { type BaseModel, getModel, userSession } from '../models/index';
import * as models from '../models/index';
import { isMockRoute, type MockRoute } from '../models/mock-route';
import { isRequest, type Request } from '../models/request';
import { isRequestGroup } from '../models/request-group';
import { isUnitTest, type UnitTest } from '../models/unit-test';
import { isUnitTestSuite, type UnitTestSuite } from '../models/unit-test-suite';
import {
  isWebSocketRequest,
  type WebSocketRequest,
} from '../models/websocket-request';
import { isWorkspace, type Workspace } from '../models/workspace';
import type { CurrentPlan } from '../ui/routes/organization';
import { convert, type InsomniaImporter } from '../utils/importers/convert';
import { id as postmanEnvImporterId } from '../utils/importers/importers/postman-env';
import { invariant } from '../utils/invariant';
import { database as db } from './database';
import { importInsomniaV5Data } from './insomnia-v5';
import { generateId } from './misc';

export interface ExportedModel extends BaseModel {
  _type: string;
}

interface ConvertResult {
  type: InsomniaImporter;
  data: {
    resources: ExportedModel[];
  };
}

const isSubEnvironmentResource = (environment: Environment) => {
  return !environment.parentId || environment.parentId.startsWith(models.environment.prefix) || environment.parentId.startsWith('__BASE_ENVIRONMENT_ID__');
};

export const isInsomniaV4Import = ({ id }: Pick<InsomniaImporter, 'id'>) =>
  id === 'insomnia-4';

export async function fetchImportContentFromURI({ uri }: { uri: string }) {
  const url = new URL(uri);

  if (url.origin === 'https://github.com') {
    uri = uri
      .replace('https://github.com', 'https://raw.githubusercontent.com')
      .replace('blob/', '');
  }

  if (uri.match(/^(http|https):\/\//)) {
    const response = await fetch(uri);
    const content = await response.text();

    return content;
  } else if (uri.match(/^(file):\/\//)) {
    const path = uri.replace(/^(file):\/\//, '');
    const content = await readFile(path, 'utf8');

    return content;
  } else {
    // Treat everything else as raw text
    const content = decodeURIComponent(uri);

    return content;
  }
}

export interface ImportFileDetail {
  contentStr: string;
  oriFileName: string;
}

export interface PostmanDataDumpRawData {
  collectionList: ImportFileDetail[];
  envList: ImportFileDetail[];
}

export async function getFilesFromPostmanExportedDataDump(filePath: string): Promise<PostmanDataDumpRawData> {
  let res;
  try {
    res = await window.main.extractJsonFileFromPostmanDataDumpArchive(filePath);
  } catch (err) {
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
  requests?: (Request | WebSocketRequest | GrpcRequest)[];
  workspaces?: Workspace[];
  environments?: BaseEnvironment[];
  apiSpecs?: ApiSpec[];
  cookieJars?: CookieJar[];
  unitTests?: UnitTest[];
  unitTestSuites?: UnitTestSuite[];
  mockRoutes?: MockRoute[];
  type?: InsomniaImporter;
  oriFileName?: string;
  errors: string[];
}

interface ResourceCacheType {
  content: string;
  resources: BaseModel[];
  importer: InsomniaImporter;
};

let resourceCacheList: ResourceCacheType[] = [];

export async function scanResources(contentList: string[] | ImportFileDetail[]): Promise<ScanResult[]> {
  resourceCacheList = [];
  const results = await Promise.allSettled(contentList.map(async content => {
    const contentStr = typeof content === 'string' ? content : content.contentStr;
    const oriFileName = typeof content === 'string' ? '' : content.oriFileName;

    let result: ConvertResult | null = null;

    try {
      const insomnia5Import = importInsomniaV5Data(contentStr);
      if (insomnia5Import.length > 0) {
        result = {
          type: {
            id: 'insomnia-5',
            name: 'Insomnia v5',
            description: 'Insomnia v5',
          },
          data: {
            // @ts-expect-error -- TSCONVERSION
            resources: insomnia5Import,
          },
        };
      } else {
        result = (await convert(contentStr)) as unknown as ConvertResult;
      }
    } catch (err: unknown) {
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
        return { ...model, type: models.MODELS_BY_EXPORT_TYPE[_type].type };
      });

    resourceCacheList.push({
      resources,
      importer: type,
      content: contentStr,
    });

    const requests = resources.filter(isRequest);
    const websocketRequests = resources.filter(isWebSocketRequest);
    const grpcRequests = resources.filter(isGrpcRequest);
    const environments = resources.filter(isEnvironment);
    const unitTests = resources.filter(isUnitTest);
    const unitTestSuites = resources.filter(isUnitTestSuite);
    const apiSpecs = resources.filter(isApiSpec);
    const workspaces = resources.filter(isWorkspace);
    const cookieJars = resources.filter(isCookieJar);
    const mockRoutes = resources.filter(isMockRoute);

    return {
      type,
      unitTests,
      unitTestSuites,
      requests: [...requests, ...websocketRequests, ...grpcRequests],
      workspaces,
      environments,
      apiSpecs,
      cookieJars,
      mockRoutes,
      oriFileName,
      errors: [],
    };
  }));
  return results.map(
    retObj => retObj.status === 'fulfilled'
      ? retObj.value
      : {
        errors: [retObj.reason.toString()],
      }
  );
}

export async function importResourcesToProject({ projectId }: { projectId: string }) {
  invariant(resourceCacheList.length > 0, 'No resources to import');
  for (const resourceCacheItem of resourceCacheList) {
    const {
      resources,
      importer,
    } = resourceCacheItem;
    const bufferId = await db.bufferChanges();

    // if the resource is postman collection
    const postmanTopLevelFolder = resources.find(
      resource => isRequestGroup(resource) && resource.parentId === '__WORKSPACE_ID__'
    ) as Workspace | undefined;
    if (importer.id === 'postman' && postmanTopLevelFolder) {
      await importResourcesToNewWorkspace(projectId, resourceCacheItem, postmanTopLevelFolder);
      continue;
    }

    // if the resource is postman environment,
    if (importer.id === postmanEnvImporterId && resources.find(isEnvironment)) {
      await Promise.all(resources.filter(isEnvironment).map(resource =>
        importResourcesToNewWorkspace(projectId, resourceCacheItem, {
          name: resource.name,
          scope: 'environment',
          // __BASE_ENVIRONMENT_ID__ is the default parentId for environment imported by postman env importer, we use it to indicate the new workspace id
          _id: '__BASE_ENVIRONMENT_ID__',
        } as Workspace)
      ));
      continue;
    }

    // No workspace, so create one
    if (!resources.find(isWorkspace)) {
      await importResourcesToNewWorkspace(projectId, resourceCacheItem);
      continue;
    }

    // One or more workspaces, add all resources to all workspaces, this could import repeatedly
    await Promise.all(resources.filter(isWorkspace)
      .map(resource => importResourcesToNewWorkspace(projectId, resourceCacheItem, resource)));

    await db.flushChanges(bufferId);
  }
}
const isTeamOrAbove = async () => {
  const { accountId } = await userSession.getOrCreate();
  const currentPlan = JSON.parse(localStorage.getItem(`${accountId}:currentPlan`) || '{}') as CurrentPlan || {};
  return ['team', 'enterprise', 'enterprise-member'].includes(currentPlan?.type);
};
const updateIdsInString = (str: string, ResourceIdMap: Map<string, string>) => {
  let newString = str;
  for (const [idA, idB] of ResourceIdMap.entries()) {
    newString = newString.replace(new RegExp(idA, 'g'), idB);
  }
  return newString;
};
const importRequestWithNewIds = (request: Request, ResourceIdMap: Map<string, string>, canTransform: boolean) => {
  let transformedRequest = request;
  if (canTransform) { // if not logged in, this wont run
    transformedRequest = JSON.parse(updateIdsInString(JSON.stringify(request), ResourceIdMap));
  }
  return ({
    ...transformedRequest,
    _id: ResourceIdMap.get(request._id),
    parentId: ResourceIdMap.get(request.parentId),
  });
};

export const importResourcesToWorkspace = async ({ workspaceId }: { workspaceId: string }) => {
  invariant(resourceCacheList.length > 0, 'No resources to import');
  for (const resourceCacheItem of resourceCacheList) {
    const resources = resourceCacheItem.resources;
    const bufferId = await db.bufferChanges();
    const ResourceIdMap = new Map();
    const existingWorkspace = await models.workspace.getById(workspaceId);

    invariant(
      existingWorkspace,
      `Could not find workspace with id ${workspaceId}`
    );
    // Map new IDs
    ResourceIdMap.set(workspaceId, existingWorkspace._id);
    ResourceIdMap.set('__WORKSPACE_ID__', existingWorkspace._id);
    const toImport = resources.find(isWorkspace);
    toImport && ResourceIdMap.set(toImport._id, existingWorkspace._id);

    const optionalResources = resources.filter(
      resource =>
        !isWorkspace(resource) &&
        !isApiSpec(resource) &&
        !isCookieJar(resource) &&
        !isEnvironment(resource)
    );

    const baseEnvironment = await models.environment.getOrCreateForParentId(workspaceId);
    invariant(baseEnvironment, 'Could not create base environment');

    const baseEnvironmentFromResources = resources.filter(isEnvironment).find(env => env.parentId && env.parentId.startsWith('__WORKSPACE_ID__'));
    if (baseEnvironmentFromResources) {
      await models.environment.update(baseEnvironment, { data: baseEnvironmentFromResources.data });
    }
    const subEnvironments = resources.filter(isEnvironment).filter(isSubEnvironmentResource) || [];

    for (const environment of subEnvironments) {
      const model = getModel(environment.type);
      model && ResourceIdMap.set(environment._id, generateId(model.prefix));
      await models.environment.create({
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

    const canTransform = await isTeamOrAbove();
    // Preserve optionalResource relationships
    for (const resource of optionalResources) {
      const model = getModel(resource.type);
      if (model) {
        // Make sure we point to the new proto file
        if (isGrpcRequest(resource)) {
          await models.grpcRequest.create({
            ...resource,
            _id: ResourceIdMap.get(resource._id),
            protoFileId: ResourceIdMap.get(resource.protoFileId),
            parentId: ResourceIdMap.get(resource.parentId),
          });

          // Make sure we point unit test to the new request
        } else if (isUnitTest(resource)) {
          await models.unitTest.create({
            ...resource,
            _id: ResourceIdMap.get(resource._id),
            requestId: ResourceIdMap.get(resource.requestId),
            parentId: ResourceIdMap.get(resource.parentId),
          });
        } else if (isRequest(resource)) {
          await models.request.create(importRequestWithNewIds(resource, ResourceIdMap, canTransform));
        } else {
          await db.docCreate(model.type, {
            ...resource,
            _id: ResourceIdMap.get(resource._id),
            parentId: ResourceIdMap.get(resource.parentId),
          });
        }
      }
    }

    await db.flushChanges(bufferId);
  }
};

export const isApiSpecImport = ({ id }: Pick<InsomniaImporter, 'id'>) =>
  id === 'openapi3' || id === 'swagger2';

const importResourcesToNewWorkspace = async (
  projectId: string,
  resourceCacheItem: ResourceCacheType,
  workspaceToImport?: Workspace
) => {
  invariant(resourceCacheItem, 'No resources to import');
  const resources = resourceCacheItem.resources;
  const ResourceIdMap = new Map();
  // in order to support import from api spec yaml
  if (resourceCacheItem?.importer?.id && isApiSpecImport(resourceCacheItem.importer)) {
    const newWorkspace = await models.workspace.create({
      name: workspaceToImport?.name,
      scope: 'design',
      parentId: projectId,
    });
    models.apiSpec.updateOrCreateForParentId(newWorkspace._id, {
      contents: resourceCacheItem.content as string | undefined,
      contentType: 'yaml',
      fileName: workspaceToImport?.name,
    });
    return {
      resources,
      workspace: newWorkspace,
    };
  }
  const newWorkspace = await models.workspace.create({
    name: workspaceToImport?.name || 'Imported Workspace',
    scope: workspaceToImport?.scope || 'collection',
    parentId: projectId,
  });
  const apiSpec = resources.find(r => r.type === 'ApiSpec' && r.parentId === workspaceToImport?._id) as ApiSpec;
  const hasApiSpec = newWorkspace.scope === 'design' && isApiSpec(apiSpec);
  // if workspace is not in the resources, there will be no apiSpec, if resource type is set to api spec this could cause a bug
  if (hasApiSpec) {
    // TODO: will overwrite existing api spec, not needed after migrate hack is removed
    await models.apiSpec.updateOrCreateForParentId(newWorkspace._id, {
      contents: apiSpec.contents,
      contentType: apiSpec.contentType,
      fileName: workspaceToImport?.name,
    });

  }

  // If we're importing into a new workspace
  // Map new IDs
  ResourceIdMap.set('__WORKSPACE_ID__', newWorkspace._id);
  workspaceToImport && ResourceIdMap.set(workspaceToImport._id, newWorkspace._id);

  const resourcesWithoutWorkspaceAndApiSpec = resources.filter(
    resource => !isWorkspace(resource) && !isApiSpec(resource)
  );

  for (const resource of resourcesWithoutWorkspaceAndApiSpec) {
    const model = getModel(resource.type);
    model && ResourceIdMap.set(resource._id, generateId(model.prefix));
  }

  const canTransform = await isTeamOrAbove();
  for (const resource of resourcesWithoutWorkspaceAndApiSpec) {
    const model = getModel(resource.type);

    if (model) {
      if (isGrpcRequest(resource)) {
        await models.grpcRequest.create({
          ...resource,
          _id: ResourceIdMap.get(resource._id),
          protoFileId: ResourceIdMap.get(resource.protoFileId),
          parentId: ResourceIdMap.get(resource.parentId),
        });
      } else if (isUnitTest(resource)) {
        await models.unitTest.create({
          ...resource,
          _id: ResourceIdMap.get(resource._id),
          requestId: ResourceIdMap.get(resource.requestId),
          parentId: ResourceIdMap.get(resource.parentId),
        });
      } else if (isRequest(resource)) {
        await models.request.create(importRequestWithNewIds(resource, ResourceIdMap, canTransform));
      } else {
        await db.docCreate(model.type, {
          ...resource,
          _id: ResourceIdMap.get(resource._id),
          parentId: ResourceIdMap.get(resource.parentId),
        });
      }
    }
  }

  // Use the first sub environment as the active one
  const subEnvironments = resources.filter(isEnvironment).filter(isSubEnvironmentResource) || [];

  if (subEnvironments.length > 0) {
    const firstSubEnvironment = subEnvironments[0];

    if (firstSubEnvironment) {
      const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(
        newWorkspace._id
      );

      await models.workspaceMeta.update(workspaceMeta, {
        activeEnvironmentId: ResourceIdMap.get(firstSubEnvironment._id),
      });
    }
  }
  return {
    resources: resources.map(r => ({
      ...r,
      _id: ResourceIdMap.get(r._id),
      parentId: ResourceIdMap.get(r.parentId),
    })),
    workspace: newWorkspace,
  };
};
