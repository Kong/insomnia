import * as _stats from './stats';
import * as _settings from './settings';
import * as _workspace from './workspace';
import * as _workspaceMeta from './workspaceMeta';
import * as _environment from './environment';
import * as _cookieJar from './cookieJar';
import * as _requestGroup from './requestGroup';
import * as _requestGroupMeta from './requestGroupMeta';
import * as _request from './request';
import * as _requestMeta from './requestMeta';
import * as _response from './response';

// Reference to each model
export const stats = _stats;
export const settings = _settings;
export const workspace = _workspace;
export const workspaceMeta = _workspaceMeta;
export const environment = _environment;
export const cookieJar = _cookieJar;
export const requestGroup = _requestGroup;
export const requestGroupMeta = _requestGroupMeta;
export const request = _request;
export const requestMeta = _requestMeta;
export const response = _response;

const _models = {
  [stats.type]: stats,
  [settings.type]: settings,
  [workspace.type]: workspace,
  [workspaceMeta.type]: workspaceMeta,
  [environment.type]: environment,
  [cookieJar.type]: cookieJar,
  [requestGroup.type]: requestGroup,
  [requestGroupMeta.type]: requestGroupMeta,
  [request.type]: request,
  [requestMeta.type]: requestMeta,
  [response.type]: response,
};

export function all () {
  return Object.keys(_models).map(type => _models[type]);
}

export function types () {
  return all().map(model => model.type);
}

export function getModel (type) {
  return _models[type] || null;
}

export function getModelName (type, count = 1) {
  const model = getModel(type);
  if (!model) {
    return 'Unknown';
  } else if (count === 1) {
    return model.name;
  } else if (!model.name.match(/s$/)) {
    // Add an 's' if it doesn't already end in one
    return `${model.name}s`;
  } else {
    return model.name
  }
}

export function initModel (type, ...sources) {
  const model = getModel(type);

  // Define global default fields
  const objectDefaults = Object.assign({
    type: type,
    _id: null,
    _schema: 0,
    parentId: null,
    modified: Date.now(),
    created: Date.now(),
  }, model.init());

  // Make a new object
  const fullObject = Object.assign({}, objectDefaults, ...sources);

  // Migrate the model
  // NOTE: Do migration before pruning because we might need to look at those fields
  const migratedObject = model.migrate(fullObject);

  // Prune extra keys from doc
  for (const key of Object.keys(migratedObject)) {
    if (!objectDefaults.hasOwnProperty(key)) {
      delete migratedObject[key];
    }
  }

  return migratedObject;
}
