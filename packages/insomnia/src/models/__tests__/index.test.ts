import { assert, describe, expect, it } from 'vitest';

import * as _apiSpec from '../api-spec';
import * as _caCertificate from '../ca-certificate';
import * as _clientCertificate from '../client-certificate';
import * as _cloudCredential from '../cloud-credential';
import * as _cookieJar from '../cookie-jar';
import * as _environment from '../environment';
import * as _gitCredentials from '../git-credentials';
import * as _gitRepository from '../git-repository';
import * as _grpcRequest from '../grpc-request';
import * as _grpcRequestMeta from '../grpc-request-meta';
import { getModel, modelManifest, mustGetModel } from '../index';
import * as models from '../index';
import * as _mockRoute from '../mock-route';
import * as _mockServer from '../mock-server';
import * as _oAuth2Token from '../o-auth-2-token';
import * as _pluginData from '../plugin-data';
import * as _project from '../project';
import * as _protoDirectory from '../proto-directory';
import * as _protoFile from '../proto-file';
import * as _request from '../request';
import * as _requestGroup from '../request-group';
import * as _requestGroupMeta from '../request-group-meta';
import * as _requestMeta from '../request-meta';
import * as _requestVersion from '../request-version';
import * as _response from '../response';
import * as _runnerTestResult from '../runner-test-result';
import * as _settings from '../settings';
import * as _socketIOPayload from '../socket-io-payload';
import * as _socketIORequest from '../socket-io-request';
import * as _socketIoResponse from '../socket-io-response';
import * as _stats from '../stats';
import * as _unitTest from '../unit-test';
import * as _unitTestResult from '../unit-test-result';
import * as _unitTestSuite from '../unit-test-suite';
import * as _userSession from '../user-session';
import * as _webSocketPayload from '../websocket-payload';
import * as _webSocketRequest from '../websocket-request';
import * as _webSocketResponse from '../websocket-response';
import * as _workspace from '../workspace';
import * as _workspaceMeta from '../workspace-meta';

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
export const socketIORequest = _socketIORequest;
export const socketIOPayload = _socketIOPayload;
export const socketIOResponse = _socketIoResponse;
export const webSocketResponse = _webSocketResponse;
export const workspace = _workspace;
export const workspaceMeta = _workspaceMeta;
export const userSession = _userSession;
export const cloudCredential = _cloudCredential;

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
    socketIORequest,
    socketIOPayload,
    socketIOResponse,
    cloudCredential,
  ] as const;
}
// describe('index', () => {
//   describe('getModel()', () => {
//     it('should get model if found', () => {
//       expect(getModel(models.workspace.type)).not.toBeNull();
//     });

//     it('should return null if model not found', () => {
//       expect(getModel('UNKNOWN')).toBeNull();
//     });
//   });

describe('mustGetModel()', () => {
  // it('should get model if found', () => {
  //   expect(mustGetModel(models.workspace.type)).not.toBeNull();
  // });

  // it('should return null if model not found', () => {
  //   const func = () => mustGetModel('UNKNOWN');

  //   expect(func).toThrowError('The model type UNKNOWN must exist but could not be found.');
  // });
  it('should match manifest', () => {
    const a = all().map(m => ({
      type: m.type,
      name: m.name,
      prefix: m.prefix,
      canDuplicate: m.canDuplicate,
      canSync: m.canSync,
      defaults: m.init(),
    }));
    const peopleObject = a
      .sort((a, b) => a.type.localeCompare(b.type))
      .reduce((obj, item) => {
        obj[item.type] = item;
        return obj;
      }, {});
    assert.deepEqual(peopleObject, modelManifest);
  });
});
