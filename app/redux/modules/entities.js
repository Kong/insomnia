import {combineReducers} from 'redux';

import {
  TYPE_STATS,
  TYPE_SETTINGS,
  TYPE_WORKSPACE,
  TYPE_REQUEST_GROUP,
  TYPE_REQUEST,
  TYPE_RESPONSE
} from '../../database/index';

const ENTITY_INSERT = 'entities/insert';
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
      case ENTITY_INSERT:
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
  stats: genericEntityReducer('stats'),
  settings: genericEntityReducer('settings'),
  workspaces: genericEntityReducer('workspace'),
  requestGroups: genericEntityReducer('requestGroup'),
  requests: genericEntityReducer('request'),
  responses: genericEntityReducer('response'),
  doNotPersist: () => true
})


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

const insertFns = {
  [TYPE_STATS]: stats => ({type: ENTITY_INSERT, stats}),
  [TYPE_SETTINGS]: settings => ({type: ENTITY_INSERT, settings}),
  [TYPE_WORKSPACE]: workspace => ({type: ENTITY_INSERT, workspace}),
  [TYPE_REQUEST_GROUP]: requestGroup => ({type: ENTITY_INSERT, requestGroup}),
  [TYPE_RESPONSE]: response => ({type: ENTITY_INSERT, response}),
  [TYPE_REQUEST]: request => ({type: ENTITY_INSERT, request})
};

const updateFns = {
  [TYPE_STATS]: stats => ({type: ENTITY_UPDATE, stats}),
  [TYPE_SETTINGS]: settings => ({type: ENTITY_UPDATE, settings}),
  [TYPE_WORKSPACE]: workspace => ({type: ENTITY_UPDATE, workspace}),
  [TYPE_REQUEST_GROUP]: requestGroup => ({type: ENTITY_UPDATE, requestGroup}),
  [TYPE_RESPONSE]: response => ({type: ENTITY_UPDATE, response}),
  [TYPE_REQUEST]: request => ({type: ENTITY_UPDATE, request})
};

const removeFns = {
  [TYPE_STATS]: stats => ({type: ENTITY_REMOVE, stats}),
  [TYPE_SETTINGS]: settings => ({type: ENTITY_REMOVE, settings}),
  [TYPE_WORKSPACE]: workspace => ({type: ENTITY_REMOVE, workspace}),
  [TYPE_REQUEST_GROUP]: requestGroup => ({type: ENTITY_REMOVE, requestGroup}),
  [TYPE_RESPONSE]: response => ({type: ENTITY_UPDATE, response}),
  [TYPE_REQUEST]: request => ({type: ENTITY_REMOVE, request})
};

export function insert (doc) {
  return insertFns[doc.type](doc);
}

export function update (doc) {
  return updateFns[doc.type](doc);
}

export function remove (doc) {
  return removeFns[doc.type](doc);
}
