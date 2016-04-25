import {combineReducers} from 'redux'

import {show} from './modals'
import {MODAL_ENVIRONMENT_EDITOR, MODAL_REQUEST_GROUP_RENAME} from '../../lib/constants'

export const REQUEST_GROUP_TOGGLE = 'request-groups/toggle';

// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

function allReducer (state = [], action) {
  switch (action.type) {
          
    case REQUEST_GROUP_TOGGLE:
      return state.map(
        rg => rg._id === action._id ? Object.assign({}, rg, {collapsed: !rg.collapsed}) : rg
      );

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

