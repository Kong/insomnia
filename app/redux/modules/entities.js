import {combineReducers} from 'redux'

import {TYPE_WORKSPACE, TYPE_REQUEST_GROUP, TYPE_REQUEST, TYPE_RESPONSE} from '../../database/index'
import * as workspaceFns from './workspaces'

const ENTITY_UPDATE = 'entities/update';
const ENTITY_REMOVE = 'entities/remove';

// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

function genericEntityReducer (referenceName) {
  return function (state = {}, action) {
    const doc = action[referenceName];

    if (!doc) {
      return state;
    }

    switch (action.type) {

      case ENTITY_UPDATE:
        return {...state, [doc._id]: doc};

      case ENTITY_REMOVE:
        const newState = Object.assign({}, state);
        delete newState[action[referenceName]._id];
        return newState;

      default:
        return state;
    }
  }
}

export default combineReducers({
  workspaces: genericEntityReducer('workspace'),
  requestGroups: genericEntityReducer('requestGroup'),
  requests: genericEntityReducer('request'),
  responses: genericEntityReducer('response')
})


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

const updateFns = {
  [TYPE_WORKSPACE]: workspace => ({type: ENTITY_UPDATE, workspace}),
  [TYPE_REQUEST_GROUP]: requestGroup => ({type: ENTITY_UPDATE, requestGroup}),
  [TYPE_RESPONSE]: response => ({type: ENTITY_UPDATE, response}),
  [TYPE_REQUEST]: request => ({type: ENTITY_UPDATE, request})
};

const removeFns = {
  [TYPE_WORKSPACE]: workspace => ({type: ENTITY_REMOVE, workspace}),
  [TYPE_REQUEST_GROUP]: requestGroup => ({type: ENTITY_REMOVE, requestGroup}),
  [TYPE_RESPONSE]: response => ({type: ENTITY_UPDATE, response}),
  [TYPE_REQUEST]: request => ({type: ENTITY_REMOVE, request})
};

export function update (doc) {
  return updateFns[doc.type](doc);
}

export function remove (doc) {
  return removeFns[doc.type](doc);
}
