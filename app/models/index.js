import * as _stats from './stats';
import * as _settings from './settings';
import * as _workspace from './workspace';
import * as _environment from './environment';
import * as _cookieJar from './cookieJar';
import * as _requestGroup from './requestGroup';
import * as _request from './request';
import * as _response from './response';

// Reference to each model
export const stats = _stats;
export const settings = _settings;
export const workspace = _workspace;
export const environment = _environment;
export const cookieJar = _cookieJar;
export const requestGroup = _requestGroup;
export const request = _request;
export const response = _response;

const _models = {
  [stats.type]: stats,
  [settings.type]: settings,
  [workspace.type]: workspace,
  [environment.type]: environment,
  [cookieJar.type]: cookieJar,
  [requestGroup.type]: requestGroup,
  [request.type]: request,
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

export function initModel (type) {
  const baseDefaults = {
    _id: null,
    type,
    modified: Date.now(),
    created: Date.now(),
    parentId: null
  };

  const modelDefaults = getModel(type).init();

  return Object.assign(baseDefaults, modelDefaults);
}
