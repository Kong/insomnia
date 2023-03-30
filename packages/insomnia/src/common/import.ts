import { readFile } from 'fs/promises';

import { ApiSpec, isApiSpec } from '../models/api-spec';
import { BaseEnvironment, isEnvironment } from '../models/environment';
import { BaseModel, getModel } from '../models/index';
import * as models from '../models/index';
import { isRequest, Request } from '../models/request';
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
  requests?: Request[];
  workspace?: Workspace;
  environments?: BaseEnvironment[];
  apiSpec?: ApiSpec;
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

  const resources = data.resources.filter(r => r._type).map(r => {
    const { _type, ...model } = r;
    return { ...model, type: models.MODELS_BY_EXPORT_TYPE[_type].type };
  });

  ResourceCache = {
    resources,
    type,
    content,
  };

  const requests = resources.filter(isRequest);
  const environments = resources.filter(isEnvironment);
  const apiSpec = resources.find(isApiSpec);
  const workspace = resources.find(isWorkspace);

  return {
    type,
    requests,
    workspace,
    environments,
    apiSpec,
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
  const resourcesWorkspace = resources.find(isWorkspace);
  const resourcesApiSpec = resources.find(isApiSpec);

  let workspace: Workspace;

  if (workspaceId === 'create-new-workspace-id') {
    const scope = (isApiSpecImport(ResourceCache?.type) || Boolean(resources.find(r => r.type === 'ApiSpec'))) ? 'design' : 'collection';
    workspace = await models.workspace.create({
      name: workspaceName,
      scope,
      parentId: projectId,
    });

    if (resourcesApiSpec) {
      await models.apiSpec.updateOrCreateForParentId(workspace._id, { ...resourcesApiSpec, fileName: workspaceName });
    }

    if (isApiSpecImport(ResourceCache?.type) && workspace.scope === 'design') {
      await models.apiSpec.updateOrCreateForParentId(workspace._id, {
        fileName: workspaceName,
        contents: ResourceCache.content,
        contentType: 'yaml',
      });
    }

  } else if (workspaceId) {
    const existingWorkspace = await models.workspace.getById(workspaceId);

    invariant(
      existingWorkspace,
      `Could not find workspace with id ${workspaceId}`
    );

    workspace = existingWorkspace;
  } else {
    workspace = await models.workspace.create({
      name: workspaceName || resourcesWorkspace?.name || 'Untitled',
      parentId: projectId,
    });
  }

  const resourcesWithoutWorkspaceAndApiSpec = resources.filter(resource => !isWorkspace(resource) && !isApiSpec(resource));

  // Map new IDs
  const ResourceIdMap = new Map();
  ResourceIdMap.set(workspaceId, workspace._id);
  ResourceIdMap.set('__WORKSPACE_ID__', workspace._id);
  resourcesWorkspace &&
    ResourceIdMap.set(resourcesWorkspace._id, workspace._id);

  for (const resource of resourcesWithoutWorkspaceAndApiSpec) {
    const model = getModel(resource.type);
    if (model) {
      ResourceIdMap.set(resource._id, generateId(model.prefix));
    } else {
      console.log('[Import Scan] Could not find model for type', resource.type);
    }
  }

  for (const resource of resourcesWithoutWorkspaceAndApiSpec) {
    const model = getModel(resource.type);

    if (model) {
      await db.docCreate(model.type, {
        ...resource,
        _id: ResourceIdMap.get(resource._id),
        parentId: ResourceIdMap.get(resource.parentId),
      });
    }
  }

  await db.flushChanges(bufferId);

  return {
    resources,
    workspace,
  };
}
