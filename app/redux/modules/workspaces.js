import {combineReducers} from 'redux';
import {MODAL_WORKSPACE_RENAME} from '../../lib/constants';
import {show} from './modals';

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
  return {type: WORKSPACE_ACTIVATE, workspace};
}
