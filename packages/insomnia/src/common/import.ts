import { readFile } from 'fs/promises';

import type { ApiSpec } from '../models/api-spec';
import { BaseEnvironment } from '../models/environment';
import type { BaseModel } from '../models/index';
import * as models from '../models/index';
import {
  Workspace,
} from '../models/workspace';
// import { SegmentEvent, trackSegmentEvent } from '../ui/analytics';
import { convert, ConvertResultType } from '../utils/importers/convert';
import { invariant } from '../utils/invariant';
import {
  EXPORT_TYPE_WORKSPACE,
} from './constants';
import { database as db } from './database';
import { generateId } from './misc';

interface ConvertResult {
  type: ConvertResultType;
  data: {
    resources: BaseModel[];
  };
}

export const isApiSpecImport = ({ id }: Pick<ConvertResultType, 'id'>) =>
  id === 'openapi3' || id === 'swagger2';

export const isInsomniaV4Import = ({ id }: Pick<ConvertResultType, 'id'>) =>
  id === 'insomnia-4';

export async function fetchImportContentFromURI({
  uri,
}: {
  uri: string;
}) {
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
    const content =  decodeURIComponent(uri);

    return content;
  }
}

export interface ScanResult {
  resources: BaseModel[];
  workspace?: Workspace;
  environments?: BaseEnvironment[];
  apiSpec?: ApiSpec;
  type?: ConvertResultType;
  errors: Error[];
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
  let results: ConvertResult;

  try {
    results = (await convert(content)) as unknown as ConvertResult;
  } catch (err: unknown) {
    return {
      resources: [],
      errors: [err as Error],
    };
  }

  const { data, type } = results;

  ResourceCache = {
    resources: data.resources,
    type,
    content,
  };

  return {
    resources: data.resources,
    type,
    workspace: data.resources.find(r => r._type === EXPORT_TYPE_WORKSPACE),
    environments: data.resources.filter(r => r._type === 'environment'),
    apiSpec: data.resources.find(r => r._type === 'api_spec'),
    errors: [],
  };
}

export async function importResources({
  resourceIds,
  workspaceId,
  projectId,
  workspaceName,
}: {
  resourceIds: string[];
  workspaceId?: string;
  workspaceName?: string;
  projectId?: string;
}) {
  invariant(ResourceCache, 'No resources to import');

  let resources = ResourceCache.resources;

  let workspace: Workspace;

  if (workspaceId === 'create-new-workspace-id') {
    workspace = await models.workspace.create({
      name: workspaceName,
      scope: 'design',
      parentId: projectId,
    });
  } else if (workspaceId) {
    const existingWorkspace = await models.workspace.getById(workspaceId);

    invariant(
      existingWorkspace,
      `Could not find workspace with id ${workspaceId}`
    );

    workspace = existingWorkspace;
  } else {
    workspace = await models.workspace.create({
      name: workspaceName || 'Imported',
      parentId: projectId,
    });
  }

  const resourcesWorkspace = resources.find(r => r._type === EXPORT_TYPE_WORKSPACE);

  resources = resources.filter(r => {
    if (resourcesWorkspace && r._type === EXPORT_TYPE_WORKSPACE) {
      return false;
    }
    return true;
  });

  const bufferId = await db.bufferChanges();

  if (isApiSpecImport(ResourceCache?.type)) {
    await models.apiSpec.updateOrCreateForParentId(
      workspace._id,
      {
        contents: ResourceCache.content,
        contentType: 'yaml',
      }
    );
  }

  // Map new IDs
  const ResourceIdMap = new Map();
  ResourceIdMap.set(workspaceId, workspace._id);
  resourcesWorkspace && ResourceIdMap.set(resourcesWorkspace._id, workspace._id);

  for (const resource of resources) {
    const model = models.MODELS_BY_EXPORT_TYPE[resource._type];
    ResourceIdMap.set(resource._id, generateId(model.prefix));
  }

  for (const resource of resources) {
    const model = models.MODELS_BY_EXPORT_TYPE[resource._type];
    await db.docCreate(model.type, { ...resource, _id: ResourceIdMap.get(resource._id), parentId: ResourceIdMap.get(resource.parentId) });
  }

  await db.flushChanges(bufferId);

  return {
    resources,
    workspace,
  };
}
