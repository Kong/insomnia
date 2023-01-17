import fs from 'fs';

import type { ApiSpec } from '../models/api-spec';
import type { BaseModel } from '../models/index';
import * as models from '../models/index';
import { Project } from '../models/project';
import { isRequest } from '../models/request';
import { isWorkspace, Workspace, WorkspaceScope, WorkspaceScopeKeys } from '../models/workspace';
import { SegmentEvent, trackSegmentEvent } from '../ui/analytics';
import { AlertModal } from '../ui/components/modals/alert-modal';
import { AskModal } from '../ui/components/modals/ask-modal';
import { showError, showModal } from '../ui/components/modals/index';
import { showSelectModal } from '../ui/components/modals/select-modal';
import { convert, ConvertResultType } from '../utils/importers/convert';
import {
  BASE_ENVIRONMENT_ID_KEY,
  CONTENT_TYPE_GRAPHQL,
  EXPORT_TYPE_WORKSPACE,
  WORKSPACE_ID_KEY,
} from './constants';
import { database as db } from './database';
import { diffPatchObj, fnOrString, generateId } from './misc';
import { strings } from './strings';

export interface ImportResult {
  source: string;
  error: Error | null;
  summary: Record<string, BaseModel[]>;
}

interface ConvertResult {
  type: ConvertResultType;
  data: {
    resources: Record<string, any>[];
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
  const { summary, error } = result;

  if (error) {
    showError({
      title: 'Failed to import',
      error,
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

  showModal(AlertModal, {
    title: 'Import Succeeded',
    message,
  });
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
  }: ImportRawConfig,
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

  const { data, type: resultsType } = results;
  // Generate all the ids we may need
  const generatedIds: Record<string, string | ((...args: any[]) => any)> = {};

  for (const r of data.resources) {
    for (const key of r._id.match(REPLACE_ID_REGEX) || []) {
      generatedIds[key] = generateId(models.MODELS_BY_EXPORT_TYPE[r._type].prefix);
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
    const baseEnvironment = await models.environment.getOrCreateForParentId(parentId);
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
  if (!data.resources.some(resource => resource._type === EXPORT_TYPE_WORKSPACE)) {
    data.resources.push({
      _id: WORKSPACE_ID_KEY,
      _type: EXPORT_TYPE_WORKSPACE,
    });
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

      if (parentId?.includes(key)) {
        resource.parentId = parentId.replace(key, await fnOrString(generatedIds[key]));
      }

      if (_id && _id.includes(key)) {
        resource._id = _id.replace(key, await fnOrString(generatedIds[key]));
      }
    }

    const model = models.MODELS_BY_EXPORT_TYPE[resource._type];

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
        resource.headers.push({
          name: 'Content-Type',
          value: 'application/json',
        });
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

      // If workspace preserve the scope and parentId of the existing workspace while importing
      if (isWorkspace(model)) {
        (updateDoc as Workspace).scope = (existingDoc as Workspace).scope;
        (updateDoc as Workspace).parentId = (existingDoc as Workspace).parentId;
      }

      newDoc = await db.docUpdate(existingDoc, updateDoc);
    } else {
      // If workspace, check and set the scope and parentId while importing a new workspace
      if (isWorkspace(model)) {
        // Set the workspace scope if creating a new workspace during import
        //  IF is creating a new workspace
        //  AND imported resource has no preset scope property OR scope is null
        //  AND we have a function to get scope
        if ((!resource.hasOwnProperty('scope') || resource.scope === null) && getWorkspaceScope) {
          const workspaceName = resource.name;
          let specName;

          // If is from insomnia v4 and the spec has contents, add to the name when prompting
          if (isInsomniaV4Import(resultsType)) {
            const spec: ApiSpec | null = await models.apiSpec.getByParentId(resource._id);

            if (spec && spec.contents.trim()) {
              specName = spec.fileName;
            }
          }

          const nameToPrompt = specName ? `${specName} / ${workspaceName}` : workspaceName;
          resource.scope = await getWorkspaceScope(nameToPrompt);
        }
        // If the workspace doesn't have a name, update the default name based on it's scope
        if (!resource.name) {
          const name =
            (resource as Workspace).scope === 'collection'
              ? `My ${strings.collection.singular}`
              : `My ${strings.document.singular}`;

          resource.name = name;
        }

        if (getProjectId) {
          // Set the workspace parent if creating a new workspace during import
          resource.parentId = await getProjectId();
        }
      }

      newDoc = await db.docCreate(model.type, resource);

      // Mark as not seen if we created a new workspace from sync
      if (isWorkspace(newDoc)) {
        const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(newDoc._id);
        await models.workspaceMeta.update(workspaceMeta, {
          hasSeen: false,
        });
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
  trackSegmentEvent(SegmentEvent.dataImport, { type: resultsType.id });
  const importRequest: ImportResult = {
    source: resultsType && typeof resultsType.id === 'string' ? resultsType.id : 'unknown',
    summary: importedDocs,
    error: null,
  };
  return importRequest;
}

export const isApiSpecImport = ({ id }: Pick<ConvertResultType, 'id'>) => (
  id === 'openapi3' || id === 'swagger2'
);

export const isInsomniaV4Import = ({ id }: Pick<ConvertResultType, 'id'>) => (
  id === 'insomnia-4'
);

export enum ForceToWorkspace {
  new = 'new',
  current = 'current',
  existing = 'existing'
}

export type SelectExistingWorkspacePrompt = Promise<string | null>;

// Returning null instead of a string will create a new workspace
export type ImportToWorkspacePrompt = () => null | string | Promise<null | string>;
export function askToImportIntoWorkspace({ workspaceId, forceToWorkspace, activeProjectWorkspaces }: { workspaceId?: string; forceToWorkspace?: ForceToWorkspace; activeProjectWorkspaces?: Workspace[] }): ImportToWorkspacePrompt {
  return function() {
    switch (forceToWorkspace) {
      case ForceToWorkspace.new: {
        return null;
      }

      case ForceToWorkspace.current: {
        if (!workspaceId) {
          return null;
        }

        return workspaceId;
      }

      case ForceToWorkspace.existing: {
        // Return null if there are no available workspaces to chose from.
        if (activeProjectWorkspaces?.length) {
          return null;
        }
      }

      default: {
        if (!workspaceId) {
          return null;
        }

        return new Promise(resolve => {
          showModal(AskModal, {
            title: 'Import',
            message: 'Do you want to import into the current workspace or a new one?',
            yesText: 'Current',
            noText: 'New Workspace',
            onDone: async (yes: boolean) => {
              resolve(yes ? workspaceId : null);
            },
          });
        });
      }
    }
  };
}

export type SetWorkspaceScopePrompt = (name?: string) => WorkspaceScope | Promise<WorkspaceScope>;
export function askToSetWorkspaceScope(scope?: WorkspaceScope): SetWorkspaceScopePrompt {
  return name => {
    switch (scope) {
      case WorkspaceScopeKeys.collection:
      case WorkspaceScopeKeys.design:
        return scope;

      default:
        return new Promise(resolve => {
          const message = name
            ? `How would you like to import "${name}"?`
            : 'Do you want to import as a Request Collection or a Design Document?';

          showModal(AskModal, {
            title: 'Import As',
            message,
            noText: 'Request Collection',
            yesText: 'Design Document',
            onDone: async (yes: boolean) => {
              resolve(yes ? WorkspaceScopeKeys.design : WorkspaceScopeKeys.collection);
            },
          });
        });
    }
  };
}

export type SetProjectIdPrompt = () => Promise<string>;
export function askToImportIntoProject({ projects, activeProject }: { projects?: Project[]; activeProject?: Project }): SetProjectIdPrompt {
  return function() {
    return new Promise(resolve => {
      // If only one project exists, return that
      if (projects?.length === 1) {
        return resolve(projects[0]._id);
      }

      const options = projects?.map(project => ({ name: project.name, value: project._id })) || [];
      const defaultValue = activeProject?._id || null;

      showSelectModal({
        title: 'Import',
        message: `Select a ${strings.project.singular.toLowerCase()} to import into`,
        options,
        value: defaultValue,
        onDone: selectedProjectId => {
          // @ts-expect-error onDone can send null as an argument; why/how?
          resolve(selectedProjectId);
        },
      });
    });
  };
}
