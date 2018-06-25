// @flow
import { convert } from 'insomnia-importers';
import * as db from './database';
import * as har from './har';
import type { BaseModel } from '../models/index';
import * as models from '../models/index';
import { getAppVersion } from './constants';
import { showModal } from '../ui/components/modals/index';
import AlertModal from '../ui/components/modals/alert-modal';
import * as fetch from './fetch';
import fs from 'fs';
import type { Workspace } from '../models/workspace';
import type { Environment } from '../models/environment';
import { fnOrString, generateId } from './misc';

const EXPORT_FORMAT = 3;

const EXPORT_TYPE_REQUEST = 'request';
const EXPORT_TYPE_REQUEST_GROUP = 'request_group';
const EXPORT_TYPE_WORKSPACE = 'workspace';
const EXPORT_TYPE_COOKIE_JAR = 'cookie_jar';
const EXPORT_TYPE_ENVIRONMENT = 'environment';

// If we come across an ID of this form, we will replace it with a new one
const REPLACE_ID_REGEX = /^__\w+_\d+__$/;

const MODELS = {
  [EXPORT_TYPE_REQUEST]: models.request,
  [EXPORT_TYPE_REQUEST_GROUP]: models.requestGroup,
  [EXPORT_TYPE_WORKSPACE]: models.workspace,
  [EXPORT_TYPE_COOKIE_JAR]: models.cookieJar,
  [EXPORT_TYPE_ENVIRONMENT]: models.environment
};

export async function importUri(
  workspaceId: string | null,
  uri: string
): Promise<void> {
  let rawText;
  if (uri.match(/^(http|https):\/\//)) {
    const response = await fetch.rawFetch(uri);
    rawText = await response.text();
  } else if (uri.match(/^(file):\/\//)) {
    const path = uri.replace(/^(file):\/\//, '');
    rawText = fs.readFileSync(path, 'utf8');
  } else {
    throw new Error(`Invalid import URI ${uri}`);
  }

  const result = await importRaw(workspaceId, rawText);
  const { summary, error } = result;

  if (error) {
    showModal(AlertModal, { title: 'Import Failed', message: error });
    return;
  }

  let statements = Object.keys(summary)
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
}

export async function importRaw(
  workspaceId: string | null,
  rawContent: string,
  generateNewIds: boolean = false
): Promise<{
  source: string,
  error: string | null,
  summary: { [string]: Array<BaseModel> }
}> {
  let results;
  try {
    results = await convert(rawContent);
  } catch (e) {
    console.warn('Failed to import data', e);
    return {
      source: 'not found',
      error: 'No importers found for file',
      summary: {}
    };
  }

  const { data } = results;

  let workspace: Workspace | null = await models.workspace.getById(
    workspaceId || 'n/a'
  );

  // Fetch the base environment in case we need it
  let baseEnvironment: Environment | null = await models.environment.getOrCreateForWorkspaceId(
    workspaceId || 'n/a'
  );

  // Generate all the ids we may need
  const generatedIds: { [string]: string | Function } = {};
  for (const r of data.resources) {
    if (generateNewIds || r._id.match(REPLACE_ID_REGEX)) {
      generatedIds[r._id] = generateId(MODELS[r._type].prefix);
    }
  }

  // Always replace these "constants"
  generatedIds['__WORKSPACE_ID__'] = async () => {
    if (!workspace) {
      workspace = await models.workspace.create({ name: 'Imported Workspace' });
    }

    return workspace._id;
  };

  generatedIds['__BASE_ENVIRONMENT_ID__'] = async () => {
    if (!baseEnvironment) {
      if (!workspace) {
        workspace = await models.workspace.create({
          name: 'Imported Workspace'
        });
      }
      baseEnvironment = await models.environment.getOrCreateForWorkspace(
        workspace
      );
    }
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
      resource.parentId = '__WORKSPACE_ID__';
    }

    // Replace _id if we need to
    if (generatedIds[resource._id]) {
      resource._id = await fnOrString(generatedIds[resource._id]);
    }

    // Replace newly generated IDs if they exist
    if (generatedIds[resource.parentId]) {
      resource.parentId = await fnOrString(generatedIds[resource.parentId]);
    }

    const model: Object = MODELS[resource._type];
    if (!model) {
      console.warn('Unknown doc type for import', resource._type);
      continue;
    }

    const existingDoc = await model.getById(resource._id);
    let newDoc: BaseModel;
    if (existingDoc) {
      newDoc = await db.docUpdate(existingDoc, resource);
    } else {
      newDoc = await db.docCreate(model.type, resource);

      // Mark as not seen if we created a new workspace from sync
      if (newDoc.type === models.workspace.type) {
        const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(
          newDoc._id
        );
        await models.workspaceMeta.update(workspaceMeta, { hasSeen: false });
      }
    }

    importedDocs[newDoc.type].push(newDoc);
  }

  await db.flushChanges();

  return {
    source:
      results.type && typeof results.type.id === 'string'
        ? results.type.id
        : 'unknown',
    summary: importedDocs,
    error: null
  };
}

export async function exportHAR(
  parentDoc: BaseModel | null = null,
  includePrivateDocs: boolean = false
): Promise<string> {
  let workspaces;
  if (parentDoc) {
    workspaces = [parentDoc];
  } else {
    workspaces = await models.workspace.all();
  }

  const workspaceEnvironmentLookup = {};
  for (let workspace of workspaces) {
    const workspaceMeta = await models.workspaceMeta.getByParentId(
      workspace._id
    );
    let environmentId = workspaceMeta
      ? workspaceMeta.activeEnvironmentId
      : null;
    const environment = await models.environment.getById(
      environmentId || 'n/a'
    );
    if (!environment || (environment.isPrivate && !includePrivateDocs)) {
      environmentId = 'n/a';
    }
    workspaceEnvironmentLookup[workspace._id] = environmentId;
  }

  const requests = [];
  for (let workspace of workspaces) {
    const docs: Array<BaseModel> = await getDocWithDescendants(
      workspace,
      includePrivateDocs
    );
    const workspaceRequests = docs
      .filter(d => d.type === models.request.type)
      .sort((a: Object, b: Object) => (a.metaSortKey < b.metaSortKey ? -1 : 1))
      .map((request: BaseModel) => {
        return {
          requestId: request._id,
          environmentId: workspaceEnvironmentLookup[workspace._id]
        };
      });

    requests.push(...workspaceRequests);
  }

  const data = await har.exportHar(requests);

  return JSON.stringify(data, null, '\t');
}

export async function exportJSON(
  parentDoc: BaseModel | null = null,
  includePrivateDocs: boolean = false
): Promise<string> {
  const data = {
    _type: 'export',
    __export_format: EXPORT_FORMAT,
    __export_date: new Date(),
    __export_source: `insomnia.desktop.app:v${getAppVersion()}`,
    resources: []
  };

  const docs: Array<BaseModel> = await getDocWithDescendants(
    parentDoc,
    includePrivateDocs
  );

  data.resources = docs
    .filter(
      d =>
        // Only export these model types
        d.type === models.request.type ||
        d.type === models.requestGroup.type ||
        d.type === models.workspace.type ||
        d.type === models.cookieJar.type ||
        d.type === models.environment.type
    )
    .map((d: Object) => {
      if (d.type === models.workspace.type) {
        d._type = EXPORT_TYPE_WORKSPACE;
      } else if (d.type === models.cookieJar.type) {
        d._type = EXPORT_TYPE_COOKIE_JAR;
      } else if (d.type === models.environment.type) {
        d._type = EXPORT_TYPE_ENVIRONMENT;
      } else if (d.type === models.requestGroup.type) {
        d._type = EXPORT_TYPE_REQUEST_GROUP;
      } else if (d.type === models.request.type) {
        d._type = EXPORT_TYPE_REQUEST;
      }

      // Delete the things we don't want to export
      delete d.type;
      return d;
    });

  return JSON.stringify(data, null, '\t');
}

async function getDocWithDescendants(
  parentDoc: BaseModel | null = null,
  includePrivateDocs: boolean = false
): Promise<Array<BaseModel>> {
  const docs = await db.withDescendants(parentDoc);
  return docs.filter(
    d =>
      // Don't include if private, except if we want to
      !(d: any).isPrivate || includePrivateDocs
  );
}
