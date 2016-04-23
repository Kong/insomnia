import {combineReducers} from 'redux'

export const WORKSPACE_UPDATE = 'workspaces/update';
export const WORKSPACE_DELETE = 'workspaces/delete';
export const WORKSPACE_ACTIVATE = 'workspaces/activate';

// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

function allReducer (state = [], action) {
  switch (action.type) {
    default:
      return state;
  }
}

function activeReducer (state = null, action) {
  switch (action.type) {
    default:
      return state;

  }
}

function filterReducer (state = '', action) {
  switch (action.type) {
    default:
      return state;
  }
}

export default combineReducers({
  all: allReducer,
  filter: filterReducer,
  active: activeReducer
});


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export function remove (request) {
  return {type: WORKSPACE_DELETE, request};
}

export function update (request) {
  return {type: WORKSPACE_UPDATE, request};
}

export function activate (request) {
  return {type: WORKSPACE_ACTIVATE, request};
}

