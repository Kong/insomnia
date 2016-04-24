import {combineReducers} from 'redux'
import * as db from '../../database'
import {initStore} from '../initstore'

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

export default combineReducers({
  all: allReducer,
  filter: filterReducer,
  active: activeReducer
});


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
    dispatch({type: WORKSPACE_ACTIVATE, workspace});
  }
}

