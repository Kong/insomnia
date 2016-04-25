import {combineReducers} from 'redux'

export const WORKSPACE_UPDATE = 'workspaces/update';

// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

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

    default:
      return state;
  }
}

export default combineReducers({
  active: activeReducer
});


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export function update (workspace) {
  return {type: WORKSPACE_UPDATE, workspace};
}
