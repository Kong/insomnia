import clone from 'clone';

import { database as db } from '../../../common/database';
import { pluralize } from '../../../common/misc';
import * as models from '../../../models';
import { BaseModel } from '../../../models';
import { ApiSpec } from '../../../models/api-spec';
import { ClientCertificate } from '../../../models/client-certificate';
import { CookieJar } from '../../../models/cookie-jar';
import { Environment } from '../../../models/environment';
import { GitRepository } from '../../../models/git-repository';
import { GrpcRequest } from '../../../models/grpc-request';
import { GrpcRequestMeta } from '../../../models/grpc-request-meta';
import { OAuth2Token } from '../../../models/o-auth-2-token';
import { PluginData } from '../../../models/plugin-data';
import { Project } from '../../../models/project';
import { ProtoDirectory } from '../../../models/proto-directory';
import { ProtoFile } from '../../../models/proto-file';
import { Request } from '../../../models/request';
import { RequestGroup } from '../../../models/request-group';
import { RequestGroupMeta } from '../../../models/request-group-meta';
import { RequestMeta } from '../../../models/request-meta';
import { RequestVersion } from '../../../models/request-version';
import { Response } from '../../../models/response';
import { Settings } from '../../../models/settings';
import { Stats } from '../../../models/stats';
import { UnitTest } from '../../../models/unit-test';
import { UnitTestResult } from '../../../models/unit-test-result';
import { UnitTestSuite } from '../../../models/unit-test-suite';
import { Workspace } from '../../../models/workspace';
import { WorkspaceMeta } from '../../../models/workspace-meta';

const ENTITY_CHANGES = 'entities/changes';
const ENTITY_INITIALIZE = 'entities/initialize';

// ~~~~~~~~ //
// Reducers //
// ~~~~~~~~ //
function getReducerName(type) {
  // Lowercase first letter (camel case)
  const lowerFirstLetter = `${type.slice(0, 1).toLowerCase()}${type.slice(1)}`;
  return pluralize(lowerFirstLetter);
}

type EntityRecord<T extends BaseModel> = Record<string, T>;

export interface EntitiesState {
  stats: EntityRecord<Stats>;
  settings: EntityRecord<Settings>;
  projects: EntityRecord<Project>;
  workspaces: EntityRecord<Workspace>;
  workspaceMetas: EntityRecord<WorkspaceMeta>;
  environments: EntityRecord<Environment>;
  gitRepositories: EntityRecord<GitRepository>;
  cookieJars: EntityRecord<CookieJar>;
  apiSpecs: EntityRecord<ApiSpec>;
  requestGroups: EntityRecord<RequestGroup>;
  requestGroupMetas: EntityRecord<RequestGroupMeta>;
  requests: EntityRecord<Request>;
  requestVersions: EntityRecord<RequestVersion>;
  requestMetas: EntityRecord<RequestMeta>;
  responses: EntityRecord<Response>;
  oAuth2Tokens: EntityRecord<OAuth2Token>;
  clientCertificates: EntityRecord<ClientCertificate>;
  pluginDatas: EntityRecord<PluginData>;
  unitTestSuites: EntityRecord<UnitTestSuite>;
  unitTestResults: EntityRecord<UnitTestResult>;
  unitTests: EntityRecord<UnitTest>;
  protoFiles: EntityRecord<ProtoFile>;
  protoDirectories: EntityRecord<ProtoDirectory>;
  grpcRequests: EntityRecord<GrpcRequest>;
  grpcRequestMetas: EntityRecord<GrpcRequestMeta>;
}

export const initialEntitiesState: EntitiesState = {
  stats: {},
  settings: {},
  projects: {},
  workspaces: {},
  workspaceMetas: {},
  environments: {},
  gitRepositories: {},
  cookieJars: {},
  apiSpecs: {},
  requestGroups: {},
  requestGroupMetas: {},
  requests: {},
  requestVersions: {},
  requestMetas: {},
  responses: {},
  oAuth2Tokens: {},
  clientCertificates: {},
  pluginDatas: {},
  unitTestSuites: {},
  unitTestResults: {},
  unitTests: {},
  protoFiles: {},
  protoDirectories: {},
  grpcRequests: {},
  grpcRequestMetas: {},
};

export function reducer(state = initialEntitiesState, action) {
  switch (action.type) {
    case ENTITY_INITIALIZE:
      const freshState = clone(initialEntitiesState);
      const { docs } = action;

      for (const doc of docs) {
        const referenceName = getReducerName(doc.type);
        freshState[referenceName][doc._id] = doc;
      }

      return freshState;

    case ENTITY_CHANGES:
      // NOTE: We hade clone(state) here before but it has a huge perf impact
      //   and it's not actually necessary.
      const newState = { ...state };
      const { changes } = action;

      for (const [event, doc] of changes) {
        const referenceName = getReducerName(doc.type);

        switch (event) {
          case db.CHANGE_INSERT:
          case db.CHANGE_UPDATE:
            newState[referenceName][doc._id] = doc;
            break;

          case db.CHANGE_REMOVE:
            delete newState[referenceName][doc._id];
            break;

          default:
            break;
        }
      }

      return newState;

    default:
      return state;
  }
}
// ~~~~~~~ //
// Actions //
// ~~~~~~~ //
export function addChanges(changes) {
  return {
    type: ENTITY_CHANGES,
    changes,
  };
}
export function initialize() {
  return async dispatch => {
    const docs = await allDocs();
    dispatch(initializeWith(docs));
  };
}
export function initializeWith(docs) {
  return {
    type: ENTITY_INITIALIZE,
    docs,
  };
}
export async function allDocs() {
  // NOTE: This list should be from most to least specific (ie. parents above children)
  return [
    ...(await models.settings.all()),
    ...(await models.project.all()),
    ...(await models.workspace.all()),
    ...(await models.workspaceMeta.all()),
    ...(await models.gitRepository.all()),
    ...(await models.environment.all()),
    ...(await models.cookieJar.all()),
    ...(await models.requestGroup.all()),
    ...(await models.requestGroupMeta.all()),
    ...(await models.request.all()),
    ...(await models.requestMeta.all()),
    ...(await models.requestVersion.all()),
    ...(await models.response.all()),
    ...(await models.oAuth2Token.all()),
    ...(await models.clientCertificate.all()),
    ...(await models.apiSpec.all()),
    ...(await models.unitTestSuite.all()),
    ...(await models.unitTest.all()),
    ...(await models.unitTestResult.all()),
    ...(await models.protoFile.all()),
    ...(await models.protoDirectory.all()),
    ...(await models.grpcRequest.all()),
    ...(await models.grpcRequestMeta.all()),
  ];
}
