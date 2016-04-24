import {combineReducers} from 'redux'

import {show} from './../modals'
import {MODAL_ENVIRONMENT_EDITOR, MODAL_REQUEST_GROUP_RENAME} from '../../../lib/constants'

const REQUEST_GROUP_UPDATE = 'request-groups/update';
const REQUEST_GROUP_REPLACE = 'request-groups/replace';
const REQUEST_GROUP_DELETE = 'request-groups/delete';
const REQUEST_GROUP_TOGGLE = 'request-groups/toggle';

// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

function allReducer (state = [], action) {
  switch (action.type) {

    case REQUEST_GROUP_UPDATE:
      const i = state.findIndex(rg => rg._id === action.requestGroup._id);

      if (i === -1) {
        return [action.requestGroup, ...state];
      } else {
        return [...state.slice(0, i), action.requestGroup, ...state.slice(i + 1)]
      }
    case REQUEST_GROUP_REPLACE:
      return [...action.requestGroups];

    case REQUEST_GROUP_TOGGLE:
      return state.map(
        rg => rg._id === action._id ? Object.assign({}, rg, {collapsed: !rg.collapsed}) : rg
      );

    case REQUEST_GROUP_DELETE:
      return state.filter(rg => rg._id !== action.requestGroup._id);

    default:
      return state;
  }
}

export default combineReducers({
  all: allReducer
});


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export function update (requestGroup) {
  return {type: REQUEST_GROUP_UPDATE, requestGroup};
}

export function replace (requestGroups) {
  return {type: REQUEST_GROUP_REPLACE, requestGroups};
}

export function remove (requestGroup) {
  return {type: REQUEST_GROUP_DELETE, requestGroup};
}

export function toggle (requestGroup) {
  return {type: REQUEST_GROUP_TOGGLE, requestGroup}
}

export function showUpdateNamePrompt (requestGroup) {
  const defaultValue = requestGroup.name;
  return show(MODAL_REQUEST_GROUP_RENAME, {defaultValue, requestGroup});
}

export function showEnvironmentEditModal (requestGroup) {
  return show(MODAL_ENVIRONMENT_EDITOR, {requestGroup});
}

