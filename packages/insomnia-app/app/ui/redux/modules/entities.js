import clone from 'clone';
import * as db from '../../../common/database';
import * as models from '../../../models';
import { pluralize } from '../../../common/misc';

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

const initialState = {};

for (const type of models.types()) {
  initialState[getReducerName(type)] = {};
}

export function reducer(state = initialState, action) {
  switch (action.type) {
    case ENTITY_INITIALIZE:
      const freshState = clone(initialState);
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
  return { type: ENTITY_CHANGES, changes };
}

export function initialize() {
  return async dispatch => {
    const docs = await allDocs();
    dispatch(initializeWith(docs));
  };
}

export function initializeWith(docs) {
  return { type: ENTITY_INITIALIZE, docs };
}

export async function allDocs() {
  // NOTE: This list should be from most to least specific (ie. parents above children)
  return [
    ...(await models.settings.all()),
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
