import {combineReducers} from 'redux'
import * as db from '../../../database'
import {initStore} from '../../initstore'

import responsesReducer from './responses'
import requestsReducer from './requests'
import requestGroupsReducer from './requestGroups'

const WORKSPACE_UPDATE = 'workspaces/update';
const WORKSPACE_DELETE = 'workspaces/delete';

// HACK: This one is used in the root reducer to reload everything
export const WORKSPACE_ACTIVATE = 'workspaces/activate';

// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

function allReducer (state = [], action) {
  switch (action.type) {

    case WORKSPACE_UPDATE:
      const i = state.findIndex(w => w._id === action.workspace._id);

      if (i === -1) {
        return [action.workspace, ...state];
      } else {
        return [...state.slice(0, i), action.workspace, ...state.slice(i + 1)]
      }

    case WORKSPACE_DELETE:
      return state.filter(w => w._id !== action.workspace._id);
   
    default:
      return state;
  }
}

function activeReducer (state = null, action) {
  switch (action.type) {

    case WORKSPACE_UPDATE:
      if (state && state._id === action.workspace._id) {
        return action.workspace;
      } else if (state) {
        return action.workspace.activated > state.activated ? action.workspace : state;
      } else {
        return action.workspace;
      }

    case WORKSPACE_DELETE:
      return state && state._id === action.workspace._id ? null : state;

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

const workspaceReducer = combineReducers({
  all: allReducer,
  filter: filterReducer,
  active: activeReducer,
  
  // Nested resources
  responses: responsesReducer,
  requests: requestsReducer,
  requestGroups: requestGroupsReducer
});

export default function (state = {}, action) {
  // Call the reducer manually, so we can check if the active workspace has changed
  let newState = workspaceReducer(state, action);

  const oldActiveId = state.active && state.active._id;
  const newActiveId = newState.active && newState.active._id;
  const activeWorkspaceChanged = oldActiveId !== newActiveId;

  // Clear all of these things if the workspace has changed
  if (activeWorkspaceChanged) {
    newState = Object.assign({}, newState, {
      responses: responsesReducer(undefined, action),
      requests: requestsReducer(undefined, action),
      requestGroups: requestGroupsReducer(undefined, action)
    })
  }

  return newState;
}


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export function remove (workspace) {
  return {type: WORKSPACE_DELETE, workspace};
}

export function update (workspace) {
  return {type: WORKSPACE_UPDATE, workspace};
}

export function activate (workspace) {
  return dispatch => {
    db.workspaceActivate(workspace);
    initStore(dispatch);
  }
}

