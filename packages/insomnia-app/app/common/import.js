// @flow
import { convert } from 'insomnia-importers';
import clone from 'clone';
import * as db from './database';
import * as har from './har';
import type { BaseModel } from '../models/index';
import * as models from '../models/index';
import { CONTENT_TYPE_GRAPHQL, getAppVersion } from './constants';
import { showError, showModal } from '../ui/components/modals/index';
import AlertModal from '../ui/components/modals/alert-modal';
import fs from 'fs';
import { fnOrString, generateId, diffPatchObj } from './misc';
import YAML from 'yaml';
import { trackEvent } from './analytics';
import {
  isGrpcRequest,
  isProtoDirectory,
  isProtoFile,
  isRequest,
  isRequestGroup,
  isWorkspace,
} from '../models/helpers/is-model';
import type { Workspace, WorkspaceScope } from '../models/workspace';
import type { ApiSpec } from '../models/api-spec';

const WORKSPACE_ID_KEY = '__WORKSPACE_ID__';
const BASE_ENVIRONMENT_ID_KEY = '__BASE_ENVIRONMENT_ID__';

const EXPORT_FORMAT = 4;

const EXPORT_TYPE_REQUEST = 'request';
const EXPORT_TYPE_GRPC_REQUEST = 'grpc_request';
const EXPORT_TYPE_REQUEST_GROUP = 'request_group';
const EXPORT_TYPE_UNIT_TEST_SUITE = 'unit_test_suite';
const EXPORT_TYPE_UNIT_TEST = 'unit_test';
const EXPORT_TYPE_WORKSPACE = 'workspace';
const EXPORT_TYPE_COOKIE_JAR = 'cookie_jar';
const EXPORT_TYPE_ENVIRONMENT = 'environment';
const EXPORT_TYPE_API_SPEC = 'api_spec';
const EXPORT_TYPE_PROTO_FILE = 'proto_file';
const EXPORT_TYPE_PROTO_DIRECTORY = 'proto_directory';

// If we come across an ID of this form, we will replace it with a new one
const REPLACE_ID_REGEX = /__\w+_\d+__/g;

const MODELS = {
  [EXPORT_TYPE_REQUEST]: models.request,
  [EXPORT_TYPE_GRPC_REQUEST]: models.grpcRequest,
  [EXPORT_TYPE_REQUEST_GROUP]: models.requestGroup,
  [EXPORT_TYPE_UNIT_TEST_SUITE]: models.unitTestSuite,
  [EXPORT_TYPE_UNIT_TEST]: models.unitTest,
  [EXPORT_TYPE_WORKSPACE]: models.workspace,
  [EXPORT_TYPE_COOKIE_JAR]: models.cookieJar,
  [EXPORT_TYPE_ENVIRONMENT]: models.environment,
  [EXPORT_TYPE_API_SPEC]: models.apiSpec,
  [EXPORT_TYPE_PROTO_FILE]: models.protoFile,
  [EXPORT_TYPE_PROTO_DIRECTORY]: models.protoDirectory,
};

export type ImportResult = {
  source: string,
  error: Error | null,
  summary: { [string]: Array<BaseModel> },
};

type ConvertResultType = {
  id: string,
  name: string,
  description: string,
};

type ConvertResult = {
  type: ConvertResultType,
  data: {
    resources: Array<Object>,
  },
};

export type ImportRawConfig = {
  getWorkspaceId: () => Promise<string | null>,
  getWorkspaceScope?: string => Promise<WorkspaceScope>,
  enableDiffBasedPatching?: boolean,
  enableDiffDeep?: boolean,
  bypassDiffProps?: {
    url: string,
  },
};

export async function importUri(uri: string, importConfig: ImportRawConfig): Promise<ImportResult> {
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
  const { summary, error } = result;

  if (error) {
    showError({
      title: 'Failed to import',
      error: error.message,
      message: 'Import failed',
    });
    return result;
  }

  const statements = Object.keys(summary)
    .map(type => {
      const count = summary[type].length;
      const name = models.getModelName(type, count);
      return count === 0 ? null : `${count} ${name}`;
    })
    .filter(s => s !== null);

  let message;
  if (statements.length === 0) {
    message = 'Nothing was found to import.';
  } else {
    message = `You imported ${statements.join(', ')}!`;
  }
  showModal(AlertModal, { title: 'Import Succeeded', message });

  return result;
}

export async function importRaw(
  rawContent: string,
  {
    getWorkspaceId,
    getWorkspaceScope,
    enableDiffBasedPatching,
    enableDiffDeep,
    bypassDiffProps,
  }: ImportRawConfig,
): Promise<ImportResult> {
  let results: ConvertResult;
  try {
    results = await convert(rawContent);
  } catch (err) {
    return {
      source: 'not found',
      error: err,
      summary: {},
    };
  }

  const { data, type: resultsType } = results;

  // Generate all the ids we may need
  const generatedIds: { [string]: string | Function } = {};
  for (const r of data.resources) {
    for (const key of r._id.match(REPLACE_ID_REGEX) || []) {
      generatedIds[key] = generateId(MODELS[r._type].prefix);
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
    const baseEnvironment = await models.environment.getOrCreateForWorkspaceId(parentId);

    // Update this fn so it doesn't run again
    generatedIds[BASE_ENVIRONMENT_ID_KEY] = baseEnvironment._id;

    return baseEnvironment._id;
  };

  // Import everything backwards so they get inserted in the correct order
  data.resources.reverse();

  const importedDocs = {};
  for (const model of models.all()) {
    importedDocs[model.type] = [];
  }

  for (const resource of data.resources) {
    // Buffer DB changes
    // NOTE: Doing it inside here so it's more "scalable"
    await db.bufferChanges(100);

    // Replace null parentIds with current workspace
    if (!resource.parentId && resource._type !== EXPORT_TYPE_WORKSPACE) {
      resource.parentId = WORKSPACE_ID_KEY;
    }

    // Replace ID placeholders (eg. __WORKSPACE_ID__) with generated values
    for (const key of Object.keys(generatedIds)) {
      const { parentId, _id } = resource;

      if (parentId && parentId.includes(key)) {
        resource.parentId = parentId.replace(key, await fnOrString(generatedIds[key]));
      }

      if (_id && _id.includes(key)) {
        resource._id = _id.replace(key, await fnOrString(generatedIds[key]));
      }
    }

    const model: Object = MODELS[resource._type];
    if (!model) {
      console.warn('Unknown doc type for import', resource._type);
      continue;
    }

    // Hack to switch to GraphQL based on finding `graphql` in the URL path
    // TODO: Support this in a better way
    if (
      isRequest(model) &&
      resource.body &&
      typeof resource.body.text === 'string' &&
      typeof resource.url === 'string' &&
      resource.body.text.includes('"query"') &&
      resource.url.includes('graphql')
    ) {
      resource.body.mimeType = CONTENT_TYPE_GRAPHQL;
    }

    // Try adding Content-Type JSON if no Content-Type exists
    if (
      isRequest(model) &&
      resource.body &&
      typeof resource.body.text === 'string' &&
      Array.isArray(resource.headers) &&
      !resource.headers.find(h => h.name.toLowerCase() === 'content-type')
    ) {
      try {
        JSON.parse(resource.body.text);
        resource.headers.push({ name: 'Content-Type', value: 'application/json' });
      } catch (err) {
        // Not JSON
      }
    }

    const existingDoc = await db.get(model.type, resource._id);
    let newDoc: BaseModel;
    if (existingDoc) {
      let updateDoc = resource;

      // Do differential patching when enabled
      if (enableDiffBasedPatching) {
        updateDoc = diffPatchObj(resource, existingDoc, enableDiffDeep);
      }

      // Bypass differential update for urls when enabled
      if (bypassDiffProps?.url && updateDoc.url) {
        updateDoc.url = resource.url;
      }

      // If workspace, don't overwrite the existing scope
      if (isWorkspace(model)) {
        (updateDoc: Workspace).scope = (existingDoc: Workspace).scope;
      }

      newDoc = await db.docUpdate(existingDoc, updateDoc);
    } else {
      if (isWorkspace(model)) {
        await updateWorkspaceScope(resource, resultsType, getWorkspaceScope);
      }
      newDoc = await db.docCreate(model.type, resource);

      // Mark as not seen if we created a new workspace from sync
      if (isWorkspace(newDoc)) {
        const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(newDoc._id);
        await models.workspaceMeta.update(workspaceMeta, { hasSeen: false });
      }
    }

    importedDocs[newDoc.type].push(newDoc);
  }

  // Store spec under workspace if it's OpenAPI
  for (const workspace of importedDocs[models.workspace.type]) {
    if (isApiSpecImport(resultsType)) {
      const spec = await models.apiSpec.updateOrCreateForParentId(workspace._id, {
        contents: rawContent,
        contentType: 'yaml',
      });

      importedDocs[spec.type].push(spec);
    }

    // Set active environment when none is currently selected and one exists
    const meta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
    const envs = importedDocs[models.environment.type];
    if (!meta.activeEnvironmentId && envs.length > 0) {
      meta.activeEnvironmentId = envs[0]._id;
      await models.workspaceMeta.update(meta);
    }
  }

  await db.flushChanges();

  trackEvent('Data', 'Import', resultsType.id);

  return {
    source: resultsType && typeof resultsType.id === 'string' ? resultsType.id : 'unknown',
    summary: importedDocs,
    error: null,
  };
}

async function updateWorkspaceScope(
  resource: Workspace,
  resultType: ConvertResultType,
  getWorkspaceScope?: string => Promise<WorkspaceScope>,
) {
  // Set the workspace scope if creating a new workspace
  //  IF is creating a new workspace
  //  AND imported resource has no preset scope property OR scope is null
  //  AND we have a function to get scope
  if ((!resource.hasOwnProperty('scope') || resource.scope === null) && getWorkspaceScope) {
    const workspaceName = resource.name;
    let specName;
    // If is from insomnia v4 and the spec has contents, add to the name when prompting
    if (isInsomniaV4Import(resultType)) {
      const spec: ApiSpec | null = await models.apiSpec.getByParentId(resource._id);

      if (spec && spec.contents.trim()) {
        specName = spec.fileName;
      }
    }
    const nameToPrompt = specName ? `${specName} / ${workspaceName}` : workspaceName;
    (resource: Workspace).scope = await getWorkspaceScope(nameToPrompt);
  }
}

export function isApiSpecImport({ id }: ConvertResultType): boolean {
  return id === 'openapi3' || id === 'swagger2';
}

export function isInsomniaV4Import({ id }: ConvertResultType): boolean {
  return id === 'insomnia-4';
}

export async function exportWorkspacesHAR(
  parentDoc: BaseModel | null = null,
  includePrivateDocs: boolean = false,
): Promise<string> {
  const docs: Array<BaseModel> = await getDocWithDescendants(parentDoc, includePrivateDocs);
  const requests: Array<BaseModel> = docs.filter(isRequest);
  return exportRequestsHAR(requests, includePrivateDocs);
}

export async function exportRequestsHAR(
  requests: Array<BaseModel>,
  includePrivateDocs: boolean = false,
): Promise<string> {
  const workspaces: Array<BaseModel> = [];
  const mapRequestIdToWorkspace: Object = {};
  const workspaceLookup: Object = {};
  for (const request of requests) {
    const ancestors: Array<BaseModel> = await db.withAncestors(request, [
      models.workspace.type,
      models.requestGroup.type,
    ]);
    const workspace = ancestors.find(isWorkspace);
    mapRequestIdToWorkspace[request._id] = workspace;
    if (workspace == null || workspaceLookup.hasOwnProperty(workspace._id)) {
      continue;
    }
    workspaceLookup[workspace._id] = true;
    workspaces.push(workspace);
  }

  const mapWorkspaceIdToEnvironmentId: Object = {};
  for (const workspace of workspaces) {
    const workspaceMeta = await models.workspaceMeta.getByParentId(workspace._id);
    let environmentId = workspaceMeta ? workspaceMeta.activeEnvironmentId : null;
    const environment = await models.environment.getById(environmentId || 'n/a');
    if (!environment || (environment.isPrivate && !includePrivateDocs)) {
      environmentId = 'n/a';
    }
    mapWorkspaceIdToEnvironmentId[workspace._id] = environmentId;
  }

  requests = requests.sort((a: Object, b: Object) => (a.metaSortKey < b.metaSortKey ? -1 : 1));
  const harRequests: Array<Object> = [];
  for (const request of requests) {
    const workspace = mapRequestIdToWorkspace[request._id];
    if (workspace == null) {
      // Workspace not found for request, so don't export it.
      continue;
    }
    const environmentId = mapWorkspaceIdToEnvironmentId[workspace._id];
    harRequests.push({
      requestId: request._id,
      environmentId: environmentId,
    });
  }

  const data = await har.exportHar(harRequests);

  trackEvent('Data', 'Export', 'HAR');

  return JSON.stringify(data, null, '\t');
}

export async function exportWorkspacesData(
  parentDoc: BaseModel | null,
  includePrivateDocs: boolean,
  format: 'json' | 'yaml',
): Promise<string> {
  const docs: Array<BaseModel> = await getDocWithDescendants(parentDoc, includePrivateDocs);
  const requests: Array<BaseModel> = docs.filter(doc => isRequest(doc) || isGrpcRequest(doc));
  return exportRequestsData(requests, includePrivateDocs, format);
}

export async function exportRequestsData(
  requests: Array<BaseModel>,
  includePrivateDocs: boolean,
  format: 'json' | 'yaml',
): Promise<string> {
  const data = {
    _type: 'export',
    __export_format: EXPORT_FORMAT,
    __export_date: new Date(),
    __export_source: `insomnia.desktop.app:v${getAppVersion()}`,
    resources: [],
  };
  const docs: Array<BaseModel> = [];
  const workspaces: Array<BaseModel> = [];
  const mapTypeAndIdToDoc: Object = {};

  for (const req of requests) {
    const ancestors: Array<BaseModel> = clone(await db.withAncestors(req));
    for (const ancestor of ancestors) {
      const key = ancestor.type + '___' + ancestor._id;
      if (mapTypeAndIdToDoc.hasOwnProperty(key)) {
        continue;
      }
      mapTypeAndIdToDoc[key] = ancestor;
      docs.push(ancestor);
      if (isWorkspace(ancestor)) {
        workspaces.push(ancestor);
      }
    }
  }

  for (const workspace of workspaces) {
    const descendants: Array<BaseModel> = (await db.withDescendants(workspace)).filter(d => {
      // Only interested in these additional model types.
      return (
        d.type === models.cookieJar.type ||
        d.type === models.environment.type ||
        d.type === models.apiSpec.type ||
        d.type === models.unitTestSuite.type ||
        d.type === models.unitTest.type ||
        isProtoFile(d) ||
        isProtoDirectory(d)
      );
    });
    docs.push(...descendants);
  }

  data.resources = docs
    .filter(d => {
      // Only export these model types.
      if (
        !(
          d.type === models.unitTestSuite.type ||
          d.type === models.unitTest.type ||
          isRequest(d) ||
          isGrpcRequest(d) ||
          isRequestGroup(d) ||
          isProtoFile(d) ||
          isProtoDirectory(d) ||
          isWorkspace(d) ||
          d.type === models.cookieJar.type ||
          d.type === models.environment.type ||
          d.type === models.apiSpec.type
        )
      ) {
        return false;
      }
      // BaseModel doesn't have isPrivate, so cast it first.
      return !(d: Object).isPrivate || includePrivateDocs;
    })
    .map((d: Object) => {
      if (isWorkspace(d)) {
        d._type = EXPORT_TYPE_WORKSPACE;
      } else if (d.type === models.cookieJar.type) {
        d._type = EXPORT_TYPE_COOKIE_JAR;
      } else if (d.type === models.environment.type) {
        d._type = EXPORT_TYPE_ENVIRONMENT;
      } else if (d.type === models.unitTestSuite.type) {
        d._type = EXPORT_TYPE_UNIT_TEST_SUITE;
      } else if (d.type === models.unitTest.type) {
        d._type = EXPORT_TYPE_UNIT_TEST;
      } else if (isRequestGroup(d)) {
        d._type = EXPORT_TYPE_REQUEST_GROUP;
      } else if (isRequest(d)) {
        d._type = EXPORT_TYPE_REQUEST;
      } else if (isGrpcRequest(d)) {
        d._type = EXPORT_TYPE_GRPC_REQUEST;
      } else if (isProtoFile(d)) {
        d._type = EXPORT_TYPE_PROTO_FILE;
      } else if (isProtoDirectory(d)) {
        d._type = EXPORT_TYPE_PROTO_DIRECTORY;
      } else if (d.type === models.apiSpec.type) {
        d._type = EXPORT_TYPE_API_SPEC;
      }

      // Delete the things we don't want to export
      delete d.type;
      return d;
    });

  trackEvent('Data', 'Export', `Insomnia ${format}`);
  if (format.toLowerCase() === 'yaml') {
    return YAML.stringify(data);
  } else if (format.toLowerCase() === 'json') {
    return JSON.stringify(data);
  } else {
    throw new Error(`Invalid export format ${format}. Must be "json" or "yaml"`);
  }
}

async function getDocWithDescendants(
  parentDoc: BaseModel | null = null,
  includePrivateDocs: boolean = false,
): Promise<Array<BaseModel>> {
  const docs = await db.withDescendants(parentDoc);
  return docs.filter(
    d =>
      // Don't include if private, except if we want to
      !(d: any).isPrivate || includePrivateDocs,
  );
}
