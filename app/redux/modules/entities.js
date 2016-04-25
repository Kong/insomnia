import {combineReducers} from 'redux'

import {TYPE_WORKSPACE, TYPE_REQUEST_GROUP, TYPE_REQUEST, TYPE_RESPONSE} from '../../database/index'
import * as workspaceFns from './workspaces'
import * as requestGroupFns from './requestGroups'
import * as requestFns from './requests'
import * as responseFns from './responses'


// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

function generateEntityReducer (referenceName, updateAction, deleteAction) {
  return function (state = {}, action) {
    switch (action.type) {

      case updateAction:
        const doc = action[referenceName];
        return {...state, [doc._id]: doc};

      case deleteAction:
        const newState = Object.assign({}, state);
        delete newState[action[referenceName]._id];
        return newState;

      default:
        return state;
    }
  }
}

const workspaces = generateEntityReducer(
  'workspace',
  workspaceFns.WORKSPACE_UPDATE,
  workspaceFns.WORKSPACE_DELETE
);

const requestGroups = generateEntityReducer(
  'requestGroup', 
  requestGroupFns.REQUEST_GROUP_UPDATE,
  requestGroupFns.REQUEST_GROUP_DELETE
);

const requests = generateEntityReducer(
  'request',
  requestFns.REQUEST_UPDATE,
  requestFns.REQUEST_DELETE
);

const responses = generateEntityReducer(
  'response',
  responseFns.RESPONSE_UPDATE,
  responseFns.RESPONSE_DELETE
);

export default combineReducers({
  workspaces,
  requestGroups,
  requests,
  responses
})


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

const updateFns = {
  [TYPE_WORKSPACE]: workspaceFns.update,
  [TYPE_REQUEST_GROUP]: requestGroupFns.update,
  [TYPE_REQUEST]: requestFns.update,
  [TYPE_RESPONSE]: responseFns.update
};

const removeFns = {
  [TYPE_WORKSPACE]: workspaceFns.remove,
  [TYPE_REQUEST_GROUP]: requestGroupFns.remove,
  [TYPE_REQUEST]: requestFns.remove
  // Response doesn't have a remove function (yet...)
};

export function update (doc) {
  // Using dispatch here because Redux gets mad if we don't return anything
  // in a normal action creator
  return dispatch => {
    if (updateFns.hasOwnProperty(doc.type)) {
      dispatch(updateFns[doc.type](doc));
    }
  }
}

export function remove (doc) {
  // Using dispatch here because Redux gets mad if we don't return anything
  // in a normal action creator
  return dispatch => {
    if (removeFns.hasOwnProperty(doc.type)) {
      dispatch(removeFns[doc.type](doc));
    }
  }
}
