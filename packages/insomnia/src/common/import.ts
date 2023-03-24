import fs from 'fs';
import { readFile } from 'fs/promises';

import type { ApiSpec } from '../models/api-spec';
import { BaseEnvironment } from '../models/environment';
import type { BaseModel } from '../models/index';
import * as models from '../models/index';
import { Project } from '../models/project';
import { isRequest } from '../models/request';
import {
  isWorkspace,
  Workspace,
  WorkspaceScope,
  WorkspaceScopeKeys,
} from '../models/workspace';
import { SegmentEvent, trackSegmentEvent } from '../ui/analytics';
import { AskModal } from '../ui/components/modals/ask-modal';
import { showModal } from '../ui/components/modals/index';
import { showSelectModal } from '../ui/components/modals/select-modal';
import { convert, ConvertResultType } from '../utils/importers/convert';
import { invariant } from '../utils/invariant';
import {
  BASE_ENVIRONMENT_ID_KEY,
  CONTENT_TYPE_GRAPHQL,
  EXPORT_TYPE_WORKSPACE,
  WORKSPACE_ID_KEY,
} from './constants';
import { database as db } from './database';
import { diffPatchObj, fnOrString, generateId } from './misc';
import { strings } from './strings';

interface ConvertResult {
  type: ConvertResultType;
  data: {
    resources: BaseModel[];
  };
}

export interface ImportRawConfig {
  getWorkspaceId: ImportToWorkspacePrompt;
  getProjectId?: () => Promise<string>;
  getWorkspaceScope?: SetWorkspaceScopePrompt;
  enableDiffBasedPatching?: boolean;
  enableDiffDeep?: boolean;
  bypassDiffProps?: {
    url: boolean;
  };
}

export async function importUri(uri: string, importConfig: ImportRawConfig) {
  let rawText;
  // If GH preview, force raw
  const url = new URL(uri);

  if (url.origin === 'https://github.com') {
    uri = uri
      .replace('https://github.com', 'https://raw.githubusercontent.com')
      .replace('blob/', '');
  }

  if (uri.match(/^(http|https):\/\//)) {
    const response = await window.fetch(uri);
    rawText = await response.text();
  } else if (uri.match(/^(file):\/\//)) {
    const path = uri.replace(/^(file):\/\//, '');
    rawText = fs.readFileSync(path, 'utf8');
  } else {
    // Treat everything else as raw text
    rawText = decodeURIComponent(uri);
  }

  const result = await importRaw(rawText, importConfig);

  return result;
}

// If we come across an ID of this form, we will replace it with a new one
const REPLACE_ID_REGEX = /__\w+_\d+__/g;

export async function importRaw(
  rawContent: string,
  {
    getWorkspaceId,
    getWorkspaceScope,
    getProjectId,
    enableDiffBasedPatching,
    enableDiffDeep,
    bypassDiffProps,
  }: ImportRawConfig
) {
  let results: ConvertResult;

  try {
    results = (await convert(rawContent)) as unknown as ConvertResult;
  } catch (err) {
    const importResult: ImportResult = {
      source: 'not found',
      error: err,
      summary: {},
    };
    return importResult;
  }

  console.log({
    results,
  });

  const { data, type: resultsType } = results;
  // Generate all the ids we may need
  const generatedIds: Record<string, string | ((...args: any[]) => any)> = {};

  for (const r of data.resources) {
    for (const key of r._id.match(REPLACE_ID_REGEX) || []) {
      generatedIds[key] = generateId(
        models.MODELS_BY_EXPORT_TYPE[r._type].prefix
      );
    }
  }

  // Contains the ID of the workspace to be used with the import
  generatedIds[WORKSPACE_ID_KEY] = async () => {
    const workspaceId = await getWorkspaceId();
    // First try getting the workspace to overwrite
    const workspace = await models.workspace.getById(workspaceId || 'n/a');
    // Update this fn so it doesn't run again
    const idToUse = workspace?._id || generateId(models.workspace.prefix);
    generatedIds[WORKSPACE_ID_KEY] = idToUse;
    return idToUse;
  };

  // Contains the ID of the base environment to be used with the import
  generatedIds[BASE_ENVIRONMENT_ID_KEY] = async () => {
    const parentId = await fnOrString(generatedIds[WORKSPACE_ID_KEY]);
    const baseEnvironment = await models.environment.getOrCreateForParentId(
      parentId
    );
    // Update this fn so it doesn't run again
    generatedIds[BASE_ENVIRONMENT_ID_KEY] = baseEnvironment._id;
    return baseEnvironment._id;
  };

  // NOTE: Although the order of the imported resources is not guaranteed,
  // all current importers will produce resources in this order:
  // Workspace > Environment > RequestGroup > Request
  // Import everything backwards so they get inserted in the correct order
  data.resources.reverse();
  const importedDocs: Record<string, any[]> = {};

  for (const model of models.all()) {
    importedDocs[model.type] = [];
  }

  // Add a workspace to the resources if it doesn't exist
  // NOTE: The workspace should be the last item of the resources
  checkForWorkspace(data);

  for (const resource of data.resources) {
    mapResource(resource, generatedIds);
  }

  // Store spec under workspace if it's OpenAPI
  for (const workspace of importedDocs[models.workspace.type]) {
    if (isApiSpecImport(resultsType)) {
      const spec = await models.apiSpec.updateOrCreateForParentId(
        workspace._id,
        {
          contents: rawContent,
          contentType: 'yaml',
        }
      );
      importedDocs[spec.type].push(spec);
    }

    // Set active environment when none is currently selected and one exists
    const meta = await models.workspaceMeta.getOrCreateByParentId(
      workspace._id
    );
    const envs = importedDocs[models.environment.type];

    if (!meta.activeEnvironmentId && envs.length > 0) {
      meta.activeEnvironmentId = envs[0]._id;
      await models.workspaceMeta.update(meta);
    }
  }

  await db.flushChanges();
  trackSegmentEvent(SegmentEvent.dataImport, { type: resultsType.id });
  const importRequest: ImportResult = {
    source:
      resultsType && typeof resultsType.id === 'string'
        ? resultsType.id
        : 'unknown',
    summary: importedDocs,
    error: null,
  };
  return importRequest;
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
}: {
  resourceIds: string[];
  workspaceId?: string;
  projectId?: string;
}) {
  console.log({
    resourceIds,
    workspaceId,
    projectId,
  });
  invariant(ResourceCache, 'No resources to import');

  const resources = ResourceCache.resources;

  let workspace: Workspace;

  if (workspaceId) {
    const existingWorkspace = await models.workspace.getById(workspaceId);

    invariant(
      existingWorkspace,
      `Could not find workspace with id ${workspaceId}`
    );

    workspace = existingWorkspace;
  } else {
    workspace = await models.workspace.create({
      name: 'Imported',
      parentId: projectId,
    });
  }

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
