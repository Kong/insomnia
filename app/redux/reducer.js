import {combineReducers} from 'redux'

import workspacesReducer from './modules/workspaces'
import requestsReducer from './modules/requests'
import tabsReducer from './modules/tabs'
import globalReducer from './modules/global'
import modalsReducer from './modules/modals'
import requestGroupsReducer from './modules/requestGroups'
import responsesReducer from './modules/responses'
import {WORKSPACE_ACTIVATE} from './modules/workspaces'

function clearOnWorkspaceActivate (reducer) {
  return function (state, action) {
    if (action.type === WORKSPACE_ACTIVATE) {
      console.log('-- CLEARING STATE --');
      state = undefined;
    }
    
    return reducer(state, action);
  }
}

export default combineReducers({
  workspaces: workspacesReducer,
  requestGroups: clearOnWorkspaceActivate(requestGroupsReducer),
  requests: clearOnWorkspaceActivate(requestsReducer),
  responses: clearOnWorkspaceActivate(responsesReducer),
  modals: modalsReducer,
  global: globalReducer,
  tabs: tabsReducer
});
