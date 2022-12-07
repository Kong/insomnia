import * as models from '@insomnia/models';
import { BaseModel } from '@insomnia/models';
import { ApiSpec } from '@insomnia/models/api-spec';
import { ClientCertificate } from '@insomnia/models/client-certificate';
import { CookieJar } from '@insomnia/models/cookie-jar';
import { Environment } from '@insomnia/models/environment';
import { GitRepository } from '@insomnia/models/git-repository';
import { GrpcRequest } from '@insomnia/models/grpc-request';
import { GrpcRequestMeta } from '@insomnia/models/grpc-request-meta';
import { OAuth2Token } from '@insomnia/models/o-auth-2-token';
import { PluginData } from '@insomnia/models/plugin-data';
import { Project } from '@insomnia/models/project';
import { ProtoDirectory } from '@insomnia/models/proto-directory';
import { ProtoFile } from '@insomnia/models/proto-file';
import { Request } from '@insomnia/models/request';
import { RequestGroup } from '@insomnia/models/request-group';
import { RequestGroupMeta } from '@insomnia/models/request-group-meta';
import { RequestMeta } from '@insomnia/models/request-meta';
import { RequestVersion } from '@insomnia/models/request-version';
import { Response } from '@insomnia/models/response';
import { Settings } from '@insomnia/models/settings';
import { Stats } from '@insomnia/models/stats';
import { UnitTest } from '@insomnia/models/unit-test';
import { UnitTestResult } from '@insomnia/models/unit-test-result';
import { UnitTestSuite } from '@insomnia/models/unit-test-suite';
import { WebSocketPayload } from '@insomnia/models/websocket-payload';
import { WebSocketRequest } from '@insomnia/models/websocket-request';
import { WebSocketResponse } from '@insomnia/models/websocket-response';
import { Workspace } from '@insomnia/models/workspace';
import { WorkspaceMeta } from '@insomnia/models/workspace-meta';
import clone from 'clone';

import { type ChangeBufferEvent, database as db } from '../../../common/database';
import { pluralize } from '../../../common/misc';

const ENTITY_CHANGES = 'entities/changes';
const ENTITY_INITIALIZE = 'entities/initialize';

// ~~~~~~~~ //
// Reducers //
// ~~~~~~~~ //
function getReducerName(type: string) {
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
  webSocketPayloads: EntityRecord<WebSocketPayload>;
  webSocketRequests: EntityRecord<WebSocketRequest>;
  webSocketResponses: EntityRecord<WebSocketResponse>;
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
  webSocketPayloads: {},
  webSocketRequests: {},
  webSocketResponses: {},
};

export function reducer(state = initialEntitiesState, action: any) {
  switch (action.type) {
    case ENTITY_INITIALIZE:
      const freshState = clone(initialEntitiesState);
      const { docs } = action;

      for (const doc of docs) {
        const referenceName = getReducerName(doc.type);
        if (!(freshState as any)[referenceName]) {
          (freshState as any)[referenceName] = {};
        }
        (freshState as any)[referenceName][doc._id] = doc;
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
            // @ts-expect-error -- mapping unsoundness
            newState[referenceName][doc._id] = doc;
            break;

          case db.CHANGE_REMOVE:
            // @ts-expect-error -- mapping unsoundness
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
export function addChanges(changes: ChangeBufferEvent[]) {
  return {
    type: ENTITY_CHANGES,
    changes,
  };
}
export function initialize() {
  return async (dispatch: any) => {
    const docs = await allDocs();
    dispatch(initializeWith(docs));
  };
}
export function initializeWith(docs: models.BaseModel[]) {
  return {
    type: ENTITY_INITIALIZE,
    docs,
  };
}
export async function allDocs() {
  // NOTE: This list should be from most to least specific (ie. parents above children)
  return [
    // missing: ...(await models.pluginData.all()),
    ...(await models.stats.all()),
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
    ...(await models.webSocketPayload.all()),
    ...(await models.webSocketRequest.all()),
    ...(await models.webSocketResponse.all()),
  ];
}
