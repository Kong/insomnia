import { readFile } from 'fs/promises';

import { ApiSpec, isApiSpec } from '../models/api-spec';
import { CookieJar, isCookieJar } from '../models/cookie-jar';
import { BaseEnvironment, isEnvironment } from '../models/environment';
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
// import { SegmentEvent, trackSegmentEvent } from '../ui/analytics';
import { convert, ConvertResultType } from '../utils/importers/convert';
import { invariant } from '../utils/invariant';
import { database as db } from './database';
import { generateId } from './misc';

export interface ExportedModel extends BaseModel {
  _type: string;
}

interface ConvertResult {
  type: ConvertResultType;
  data: {
    resources: ExportedModel[];
  };
}

export const isApiSpecImport = ({ id }: Pick<ConvertResultType, 'id'>) =>
  id === 'openapi3' || id === 'swagger2';

export const isInsomniaV4Import = ({ id }: Pick<ConvertResultType, 'id'>) =>
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
  workspace?: Workspace;
  environments?: BaseEnvironment[];
  apiSpec?: ApiSpec;
  cookieJar?: CookieJar;
  unitTests?: UnitTest[];
  unitTestSuites?: UnitTestSuite[];
  type?: ConvertResultType;
  errors: string[];
}

let ResourceCache: {
  content: string;
  resources: BaseModel[];
  type: ConvertResultType;
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
  const apiSpec = resources.find(isApiSpec);
  const workspace = resources.find(isWorkspace);
  const cookieJar = resources.find(isCookieJar);

  return {
    type,
    unitTests,
    unitTestSuites,
    requests: [...requests, ...websocketRequests, ...grpcRequests],
    workspace,
    environments,
    apiSpec,
    cookieJar,
    errors: [],
  };
}

export async function importResources({
  workspaceId,
  projectId,
  workspaceName,
}: {
  workspaceId?: string;
  workspaceName?: string;
  projectId: string;
}) {
  invariant(ResourceCache, 'No resources to import');
  const bufferId = await db.bufferChanges();

  const resources = ResourceCache.resources;
  const workspace = resources.find(isWorkspace);

  const ResourceIdMap = new Map();
  // If we're importing into an existing workspace
  if (workspaceId && workspaceId !== 'create-new-workspace-id') {
    const existingWorkspace = await models.workspace.getById(workspaceId);

    invariant(
      existingWorkspace,
      `Could not find workspace with id ${workspaceId}`
    );

    // If we're importing into a new workspace
    // Map new IDs
    ResourceIdMap.set(workspaceId, existingWorkspace._id);
    ResourceIdMap.set('__WORKSPACE_ID__', existingWorkspace._id);
    workspace && ResourceIdMap.set(workspace._id, existingWorkspace._id);

    const filteredResources = resources.filter(
      resource =>
        !isWorkspace(resource) &&
        !isApiSpec(resource) &&
        !isCookieJar(resource) &&
        !isEnvironment(resource)
    );

    for (const resource of filteredResources) {
      const model = getModel(resource.type);
      if (model) {
        ResourceIdMap.set(resource._id, generateId(model.prefix));
      } else {
        console.log(
          '[Import Scan] Could not find model for type',
          resource.type
        );
      }
    }

    for (const resource of filteredResources) {
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
      resources,
      workspace: existingWorkspace,
    };
  } else {
    const scope =
      isApiSpecImport(ResourceCache?.type) ||
        Boolean(resources.find(r => r.type === 'ApiSpec'))
        ? 'design'
        : 'collection';
    const newWorkspace = await models.workspace.create({
      name: workspaceName || workspace?.name,
      scope,
      parentId: projectId,
    });

    const apiSpec = resources.find(isApiSpec);

    if (apiSpec) {
      await models.apiSpec.updateOrCreateForParentId(newWorkspace._id, {
        ...apiSpec,
        fileName: workspaceName || workspace?.name,
      });
    }

    if (
      isApiSpecImport(ResourceCache?.type) &&
      newWorkspace.scope === 'design'
    ) {
      await models.apiSpec.updateOrCreateForParentId(newWorkspace._id, {
        fileName: workspaceName || workspace?.name,
        contents: ResourceCache.content,
        contentType: 'yaml',
      });
    }

    // If we're importing into a new workspace
    // Map new IDs
    ResourceIdMap.set(workspaceId, newWorkspace._id);
    ResourceIdMap.set('__WORKSPACE_ID__', newWorkspace._id);
    workspace && ResourceIdMap.set(workspace._id, newWorkspace._id);

    const resourcesWithoutWorkspaceAndApiSpec = resources.filter(
      resource => !isWorkspace(resource) && !isApiSpec(resource)
    );

    for (const resource of resourcesWithoutWorkspaceAndApiSpec) {
      const model = getModel(resource.type);
      if (model) {
        ResourceIdMap.set(resource._id, generateId(model.prefix));
      } else {
        console.log(
          '[Import Scan] Could not find model for type',
          resource.type
        );
      }
    }

    for (const resource of resourcesWithoutWorkspaceAndApiSpec) {
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
        } else {
          await db.docCreate(model.type, {
            ...resource,
            _id: ResourceIdMap.get(resource._id),
            parentId: ResourceIdMap.get(resource.parentId),
          });
        }
      }
    }

    console.log({ resourcesWithoutWorkspaceAndApiSpec });

    await db.flushChanges(bufferId);

    return {
      resources,
      workspace: newWorkspace,
    };
  }
}
