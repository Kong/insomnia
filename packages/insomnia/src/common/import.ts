import { readFile } from 'fs/promises';

import { ApiSpec, isApiSpec } from '../models/api-spec';
import { CookieJar, isCookieJar } from '../models/cookie-jar';
import { BaseEnvironment, Environment, isEnvironment } from '../models/environment';
import { GrpcRequest, isGrpcRequest } from '../models/grpc-request';
import { BaseModel, getModel } from '../models/index';
import * as models from '../models/index';
import { isRequest, Request } from '../models/request';
import { isUnitTest, UnitTest } from '../models/unit-test';
import { isUnitTestSuite, UnitTestSuite } from '../models/unit-test-suite';
import {
  isWebSocketRequest,
  WebSocketRequest,
} from '../models/websocket-request';
import { isWorkspace, Workspace } from '../models/workspace';
import { convert, InsomniaImporter } from '../utils/importers/convert';
import { invariant } from '../utils/invariant';
import { database as db } from './database';
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

export interface ScanResult {
  requests?: (Request | WebSocketRequest | GrpcRequest)[];
  workspaces?: Workspace[];
  environments?: BaseEnvironment[];
  apiSpecs?: ApiSpec[];
  cookieJars?: CookieJar[];
  unitTests?: UnitTest[];
  unitTestSuites?: UnitTestSuite[];
  type?: InsomniaImporter;
  errors: string[];
}

let ResourceCache: {
  content: string;
  resources: BaseModel[];
  type: InsomniaImporter;
} | null = null;

export async function scanResources({
  content,
}: {
  content: string;
}): Promise<ScanResult> {
  let results: ConvertResult | null = null;

  try {
    results = (await convert(content)) as unknown as ConvertResult;
  } catch (err: unknown) {
    if (err instanceof Error) {
      return {
        errors: [err.message],
      };
    }
  }

  if (!results) {
    return {
      errors: ['No resources found to import.'],
    };
  }

  const { type, data } = results;

  const resources = data.resources
    .filter(r => r._type)
    .map(r => {
      const { _type, ...model } = r;
      return { ...model, type: models.MODELS_BY_EXPORT_TYPE[_type].type };
    });

  ResourceCache = {
    resources,
    type,
    content,
  };

  const requests = resources.filter(isRequest);
  const websocketRequests = resources.filter(isWebSocketRequest);
  const grpcRequests = resources.filter(isGrpcRequest);
  const environments = resources.filter(isEnvironment);
  const unitTests = resources.filter(isUnitTest);
  const unitTestSuites = resources.filter(isUnitTestSuite);
  const apiSpecs = resources.filter(isApiSpec);
  const workspaces = resources.filter(isWorkspace);
  const cookieJars = resources.filter(isCookieJar);

  return {
    type,
    unitTests,
    unitTestSuites,
    requests: [...requests, ...websocketRequests, ...grpcRequests],
    workspaces,
    environments,
    apiSpecs,
    cookieJars,
    errors: [],
  };
}

export async function importResourcesToProject({ projectId }: { projectId: string }) {
  invariant(ResourceCache, 'No resources to import');
  const resources = ResourceCache.resources;
  const bufferId = await db.bufferChanges();
  if (!resources.find(isWorkspace)) {
    await importResourcesToNewWorkspace(projectId);
    return { resources };
  }
  const r = await Promise.all(resources.filter(isWorkspace)
    .map(resource => importResourcesToNewWorkspace(projectId, resource)));

  await db.flushChanges(bufferId);
  return { resources: r.flat() };
}
export const importResourcesToWorkspace = async ({ workspaceId }: { workspaceId: string }) => {
  invariant(ResourceCache, 'No resources to import');
  const resources = ResourceCache.resources;
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

  const subEnvironments = resources.filter(isEnvironment).filter(isSubEnvironmentResource) || [];

  for (const environment of subEnvironments) {
    const model = getModel(environment.type);
    model && ResourceIdMap.set(environment._id, generateId(model.prefix));

    await db.docCreate(environment.type, {
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
      // Make sure we point to the new proto file
      if (isGrpcRequest(resource)) {
        await db.docCreate(model.type, {
          ...resource,
          _id: ResourceIdMap.get(resource._id),
          protoFileId: ResourceIdMap.get(resource.protoFileId),
          parentId: ResourceIdMap.get(resource.parentId),
        });

        // Make sure we point unit test to the new request
      } else if (isUnitTest(resource)) {
        await db.docCreate(model.type, {
          ...resource,
          _id: ResourceIdMap.get(resource._id),
          requestId: ResourceIdMap.get(resource.requestId),
          parentId: ResourceIdMap.get(resource.parentId),
        });
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

  return {
    resources: resources.map(r => ({
      ...r,
      _id: ResourceIdMap.get(r._id),
      parentId: ResourceIdMap.get(r.parentId),
    })),
    workspace: existingWorkspace,
  };
};
export const isApiSpecImport = ({ id }: Pick<InsomniaImporter, 'id'>) =>
  id === 'openapi3' || id === 'swagger2';
const importResourcesToNewWorkspace = async (projectId: string, workspaceToImport?: Workspace) => {
  invariant(ResourceCache, 'No resources to import');
  const resources = ResourceCache.resources;
  const ResourceIdMap = new Map();
  // in order to support import from api spec yaml
  if (ResourceCache?.type?.id && isApiSpecImport(ResourceCache.type)) {
    const newWorkspace = await models.workspace.create({
      name: workspaceToImport?.name,
      scope: 'design',
      parentId: projectId,
    });
    models.apiSpec.updateOrCreateForParentId(newWorkspace._id, {
      contents: ResourceCache.content,
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

  for (const resource of resourcesWithoutWorkspaceAndApiSpec) {
    const model = getModel(resource.type);

    if (model) {
      if (isGrpcRequest(resource)) {
        await db.docCreate(model.type, {
          ...resource,
          _id: ResourceIdMap.get(resource._id),
          protoFileId: ResourceIdMap.get(resource.protoFileId),
          parentId: ResourceIdMap.get(resource.parentId),
        });
      } else if (isUnitTest(resource)) {
        await db.docCreate(model.type, {
          ...resource,
          _id: ResourceIdMap.get(resource._id),
          requestId: ResourceIdMap.get(resource.requestId),
          parentId: ResourceIdMap.get(resource.parentId),
        });
      } else {
        await db.docCreate(model.type, {
          ...resource,
          _id: ResourceIdMap.get(resource._id),
          parentId: ResourceIdMap.get(resource.parentId),
        });
      }
    }
  }

  // Use the first environment as the active one
  const subEnvironments =
    resources.filter(isEnvironment).filter(isSubEnvironmentResource) || [];

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
