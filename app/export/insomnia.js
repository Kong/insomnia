import * as importers from 'insomnia-importers';
import * as db from '../common/database';
import * as models from '../models';
import {getAppVersion} from '../common/constants';
import * as misc from '../common/misc';

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
  [EXPORT_TYPE_ENVIRONMENT]: models.environment,
};

export async function importJSON (workspace, json, generateNewIds = false) {
  let data;
  try {
    data = importers.import(json);
  } catch (e) {
    console.error('Failed to import data', e);
    return;
  }

  // Generate all the ids we may need
  const generatedIds = {};
  for (const r of data.resources) {
    if (generateNewIds || r._id.match(REPLACE_ID_REGEX)) {
      generatedIds[r._id] = misc.generateId(MODELS[r._type].prefix);
    }
  }

  // Also always replace __WORKSPACE_ID__ with the current workspace if we see it
  generatedIds['__WORKSPACE_ID__'] = workspace._id;

  for (const resource of data.resources) {
    // Buffer DB changes
    // NOTE: Doing it inside here so it's more "scalable"
    db.bufferChanges(100);

    // Replace null parentIds with current workspace
    if (!resource.parentId) {
      resource.parentId = '__WORKSPACE_ID__';
    }

    // Replace _id if we need to
    if (generatedIds[resource._id]) {
      resource._id = generatedIds[resource._id];
    }

    // Replace newly generated IDs if they exist
    if (generatedIds[resource.parentId]) {
      resource.parentId = generatedIds[resource.parentId];
    }

    const model = MODELS[resource._type];
    if (!model) {
      console.error('Unknown doc type for import', resource._type);
    }

    const doc = await model.getById(resource._id);

    if (doc) {
      await model.update(doc, resource)
    } else {
      await model.create(resource)
    }
  }

  db.flushChanges();
}

export async function exportJSON (parentDoc = null) {
  const data = {
    _type: 'export',
    __export_format: 2,
    __export_date: new Date(),
    __export_source: `insomnia.desktop.app:v${getAppVersion()}`,
    resources: {}
  };

  const docs = await db.withDescendants(parentDoc);

  data.resources = docs.filter(d => (
    d.type !== models.response.type &&
    d.type !== models.stats.type &&
    d.type !== models.settings.type
  )).map(d => {
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

    // Delete the type property because we add our own (_type)
    delete d.type;

    return d;
  });

  return JSON.stringify(data, null, 2);
}
