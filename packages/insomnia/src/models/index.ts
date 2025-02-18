import {
  EXPORT_TYPE_API_SPEC,
  EXPORT_TYPE_COOKIE_JAR,
  EXPORT_TYPE_ENVIRONMENT,
  EXPORT_TYPE_GRPC_REQUEST,
  EXPORT_TYPE_MOCK_ROUTE,
  EXPORT_TYPE_MOCK_SERVER,
  EXPORT_TYPE_PROTO_DIRECTORY,
  EXPORT_TYPE_PROTO_FILE,
  EXPORT_TYPE_REQUEST,
  EXPORT_TYPE_REQUEST_GROUP,
  EXPORT_TYPE_RUNNER_TEST_RESULT,
  EXPORT_TYPE_UNIT_TEST,
  EXPORT_TYPE_UNIT_TEST_SUITE,
  EXPORT_TYPE_WEBSOCKET_PAYLOAD,
  EXPORT_TYPE_WEBSOCKET_REQUEST,
  EXPORT_TYPE_WORKSPACE,
} from '../common/constants';
import { generateId } from '../common/misc';
import * as _apiSpec from './api-spec';
import * as _caCertificate from './ca-certificate';
import * as _clientCertificate from './client-certificate';
import * as _cookieJar from './cookie-jar';
import * as _environment from './environment';
import * as _gitCredentials from './git-credentials';
import * as _gitRepository from './git-repository';
import * as _grpcRequest from './grpc-request';
import * as _grpcRequestMeta from './grpc-request-meta';
import * as _mockRoute from './mock-route';
import * as _mockServer from './mock-server';
import * as _oAuth2Token from './o-auth-2-token';
import * as _pluginData from './plugin-data';
import * as _project from './project';
import * as _protoDirectory from './proto-directory';
import * as _protoFile from './proto-file';
import * as _request from './request';
import * as _requestGroup from './request-group';
import * as _requestGroupMeta from './request-group-meta';
import * as _requestMeta from './request-meta';
import * as _requestVersion from './request-version';
import * as _response from './response';
import * as _runnerTestResult from './runner-test-result';
import * as _settings from './settings';
import * as _stats from './stats';
import * as _unitTest from './unit-test';
import * as _unitTestResult from './unit-test-result';
import * as _unitTestSuite from './unit-test-suite';
import * as _userSession from './user-session';
import * as _webSocketPayload from './websocket-payload';
import * as _webSocketRequest from './websocket-request';
import * as _webSocketResponse from './websocket-response';
import * as _workspace from './workspace';
import * as _workspaceMeta from './workspace-meta';

export interface BaseModel {
  _id: string;
  type: string;
  // TSCONVERSION -- parentId is always required for all models, except 4:
  //   - Stats, Settings, and Project, which never have a parentId
  //   - Workspace optionally has a parentId (which will be the id of a Project)
  parentId: string; // or null
  modified: number;
  created: number;
  isPrivate: boolean;
  name: string;
}

// Reference to each model
export const apiSpec = _apiSpec;
export const clientCertificate = _clientCertificate;
export const caCertificate = _caCertificate;
export const cookieJar = _cookieJar;
export const environment = _environment;
export const gitCredentials = _gitCredentials;
export const gitRepository = _gitRepository;
export const mockServer = _mockServer;
export const mockRoute = _mockRoute;
export const oAuth2Token = _oAuth2Token;
export const pluginData = _pluginData;
export const request = _request;
export const requestGroup = _requestGroup;
export const requestGroupMeta = _requestGroupMeta;
export const requestMeta = _requestMeta;
export const requestVersion = _requestVersion;
export const runnerTestResult = _runnerTestResult;
export const response = _response;
export const settings = _settings;
export const project = _project;
export const stats = _stats;
export const unitTest = _unitTest;
export const unitTestSuite = _unitTestSuite;
export const unitTestResult = _unitTestResult;
export const protoFile = _protoFile;
export const protoDirectory = _protoDirectory;
export const grpcRequest = _grpcRequest;
export const grpcRequestMeta = _grpcRequestMeta;
export const webSocketPayload = _webSocketPayload;
export const webSocketRequest = _webSocketRequest;
export const webSocketResponse = _webSocketResponse;
export const workspace = _workspace;
export const workspaceMeta = _workspaceMeta;
export * as organization from './organization';
export const userSession = _userSession;

export function all() {
  // NOTE: This list should be from most to least specific (ie. parents above children)
  // For example, stats, settings, project and workspace are global models, with project and workspace being the top-most parents,
  // so they must be at the top
  return [
    stats,
    settings,
    project,
    workspace,
    workspaceMeta,
    environment,
    gitCredentials,
    gitRepository,
    cookieJar,
    apiSpec,
    requestGroup,
    requestGroupMeta,
    request,
    requestVersion,
    requestMeta,
    response,
    mockServer,
    mockRoute,
    oAuth2Token,
    caCertificate,
    clientCertificate,
    pluginData,
    unitTestSuite,
    unitTestResult,
    unitTest,
    protoFile,
    protoDirectory,
    grpcRequest,
    grpcRequestMeta,
    runnerTestResult,
    webSocketPayload,
    webSocketRequest,
    webSocketResponse,
    userSession,
  ] as const;
}

export function types() {
  return all().map(model => model.type);
}

export function canSync(d: BaseModel) {
  if (d.isPrivate) {
    return false;
  }

  const m = getModel(d.type);

  if (!m) {
    return false;
  }

  return m.canSync || false;
}

export function getModel(type: string) {
  return all().find(m => m.type === type) || null;
}

export function mustGetModel(type: string) {
  const model = getModel(type);

  if (!model) {
    throw new Error(`The model type ${type} must exist but could not be found.`);
  }

  return model;
}

export function canDuplicate(type: string) {
  const model = getModel(type);
  return model ? model.canDuplicate : false;
}

export async function initModel<T extends BaseModel>(type: string, ...sources: Record<string, any>[]): Promise<T> {
  const model = getModel(type);

  if (!model) {
    const choices = all()
      .map(m => m.type)
      .join(', ');
    throw new Error(`Tried to init invalid model "${type}". Choices are ${choices}`);
  }

  // Define global default fields
  const objectDefaults = Object.assign(
    {},
    {
      _id: null,
      type: type,
      parentId: null,
      modified: Date.now(),
      created: Date.now(),
    },
    model.init(),
  );
  const fullObject = Object.assign({}, objectDefaults, ...sources);

  // Generate an _id if there isn't one yet
  if (!fullObject._id) {
    fullObject._id = generateId(model.prefix);
  }

  // Migrate the model
  // NOTE: Do migration before pruning because we might need to look at those fields
  const migratedDoc = model.migrate(fullObject);
  // optional keys do not generated in init method but should allow update.
  // If we put those keys in init method, all related models will show as modified in git sync.
  const modelOptionalKeys: string[] = 'optionalKeys' in model ? model.optionalKeys || [] : [];
  // Prune extra keys from doc
  for (const key of Object.keys(migratedDoc)) {
    if (!objectDefaults.hasOwnProperty(key) && !modelOptionalKeys.includes(key)) {
      // @ts-expect-error -- mapping unsoundness
      delete migratedDoc[key];
    }
  }

  // @ts-expect-error -- TSCONVERSION not sure why this error is occurring
  return migratedDoc;
}

export const MODELS_BY_EXPORT_TYPE: Record<string, any> = {
  [EXPORT_TYPE_REQUEST]: request,
  [EXPORT_TYPE_WEBSOCKET_PAYLOAD]: webSocketPayload,
  [EXPORT_TYPE_WEBSOCKET_REQUEST]: webSocketRequest,
  [EXPORT_TYPE_MOCK_SERVER]: mockServer,
  [EXPORT_TYPE_MOCK_ROUTE]: mockRoute,
  [EXPORT_TYPE_GRPC_REQUEST]: grpcRequest,
  [EXPORT_TYPE_RUNNER_TEST_RESULT]: runnerTestResult,
  [EXPORT_TYPE_REQUEST_GROUP]: requestGroup,
  [EXPORT_TYPE_UNIT_TEST_SUITE]: unitTestSuite,
  [EXPORT_TYPE_UNIT_TEST]: unitTest,
  [EXPORT_TYPE_WORKSPACE]: workspace,
  [EXPORT_TYPE_COOKIE_JAR]: cookieJar,
  [EXPORT_TYPE_ENVIRONMENT]: environment,
  [EXPORT_TYPE_API_SPEC]: apiSpec,
  [EXPORT_TYPE_PROTO_FILE]: protoFile,
  [EXPORT_TYPE_PROTO_DIRECTORY]: protoDirectory,
};
