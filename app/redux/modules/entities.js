import {combineReducers} from 'redux';

import {ALL_TYPES, TYPE_RESPONSE, TYPE_STATS} from '../../database/index';

const ENTITY_BLACKLIST = {
  [TYPE_RESPONSE]: 1,
  [TYPE_STATS]: 1
};

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

    if (ENTITY_BLACKLIST[doc.type]) {
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

const reducers = {};
for (const type of ALL_TYPES) {
  // Name example: RequestGroup => requestGroups
  // Add an "s" to the end if there isn't already
  const trailer = type.match(/s$/) ? '' : 's';
  const name = `${type.slice(0, 1).toLowerCase()}${type.slice(1)}${trailer}`;
  reducers[name] = genericEntityReducer(type);
}

export default combineReducers({
  ...reducers,
  doNotPersist: () => true
});


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

const insertFns = {};
for (let type of ALL_TYPES) {
  insertFns[type] = doc => ({type: ENTITY_INSERT, [type]: doc})
}

const updateFns = {};
for (let type of ALL_TYPES) {
  updateFns[type] = doc => ({type: ENTITY_UPDATE, [type]: doc})
}

const removeFns = {};
for (let type of ALL_TYPES) {
  removeFns[type] = doc => ({type: ENTITY_REMOVE, [type]: doc})
}

export function insert (doc) {
  return insertFns[doc.type](doc);
}

export function update (doc) {
  return updateFns[doc.type](doc);
}

export function remove (doc) {
  return removeFns[doc.type](doc);
}
