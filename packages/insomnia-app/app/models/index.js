// @flow
import * as _clientCertificate from './client-certificate';
import * as _cookieJar from './cookie-jar';
import * as _environment from './environment';
import * as _oAuth2Token from './o-auth-2-token';
import * as _pluginData from './plugin-data';
import * as _request from './request';
import * as _requestGroup from './request-group';
import * as _requestGroupMeta from './request-group-meta';
import * as _requestMeta from './request-meta';
import * as _requestVersion from './request-version';
import * as _response from './response';
import * as _settings from './settings';
import * as _stats from './stats';
import * as _workspace from './workspace';
import * as _workspaceMeta from './workspace-meta';
import { generateId } from '../common/misc';

export type BaseModel = {
  _id: string,
  type: string,
  parentId: string,
  modified: number,
  created: number
};

// Reference to each model
export const clientCertificate = _clientCertificate;
export const cookieJar = _cookieJar;
export const environment = _environment;
export const oAuth2Token = _oAuth2Token;
export const pluginData = _pluginData;
export const request = _request;
export const requestGroup = _requestGroup;
export const requestGroupMeta = _requestGroupMeta;
export const requestMeta = _requestMeta;
export const requestVersion = _requestVersion;
export const response = _response;
export const settings = _settings;
export const stats = _stats;
export const workspace = _workspace;
export const workspaceMeta = _workspaceMeta;

export function all() {
  return [
    stats,
    settings,
    workspace,
    workspaceMeta,
    environment,
    cookieJar,
    requestGroup,
    requestGroupMeta,
    request,
    requestVersion,
    requestMeta,
    response,
    oAuth2Token,
    clientCertificate,
    pluginData
  ];
}

export function types() {
  return all().map(model => model.type);
}

export function getModel(type: string): Object | null {
  return all().find(m => m.type === type) || null;
}

export function canDuplicate(type: string) {
  const model = getModel(type);
  return model ? model.canDuplicate : false;
}

export function getModelName(type: string, count: number = 1) {
  const model = getModel(type);
  if (!model) {
    return 'Unknown';
  } else if (count === 1) {
    return model.name;
  } else if (!model.name.match(/s$/)) {
    // Add an 's' if it doesn't already end in one
    return `${model.name}s`;
  } else {
    return model.name;
  }
}

export async function initModel<T: BaseModel>(
  type: string,
  ...sources: Array<Object>
): Promise<T> {
  const model = getModel(type);

  if (!model) {
    const choices = all()
      .map(m => m.type)
      .join(', ');
    throw new Error(
      `Tried to init invalid model "${type}". Choices are ${choices}`
    );
  }

  // Define global default fields
  const objectDefaults = Object.assign(
    {},
    {
      _id: null,
      type: type,
      parentId: null,
      modified: Date.now(),
      created: Date.now()
    },
    model.init()
  );

  const fullObject = Object.assign({}, objectDefaults, ...sources);

  // Generate an _id if there isn't one yet
  if (!fullObject._id) {
    fullObject._id = generateId(model.prefix);
  }

  // Migrate the model
  // NOTE: Do migration before pruning because we might need to look at those fields
  const migratedDoc = await model.migrate(fullObject);

  // Prune extra keys from doc
  for (const key of Object.keys(migratedDoc)) {
    if (!objectDefaults.hasOwnProperty(key)) {
      delete migratedDoc[key];
    }
  }

  return migratedDoc;
}
