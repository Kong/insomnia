import {combineReducers} from 'redux';
import * as sync from '../../../backend/sync';

export const WORKSPACE_ACTIVATE = 'workspaces/activate';

// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

function activeReducer (state = null, action) {
  switch (action.type) {

    case WORKSPACE_ACTIVATE:
      return action.workspace._id;

    default:
      return state;
  }
}

export default combineReducers({
  activeId: activeReducer
});


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export function activate (workspace) {
  sync.activateWorkspaceId(workspace._id);
  return {type: WORKSPACE_ACTIVATE, workspace};
}
