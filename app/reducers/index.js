import {combineReducers} from 'redux'

import workspacesReducer from '../modules/workspaces'
import requestsReducer from '../modules/requests'
import tabsReducer from '../modules/tabs'
import globalReducer from '../modules/global'
import modalsReducer from '../modules/modals'
import requestGroupsReducer from '../modules/requestGroups'
import responsesReducer from '../modules/responses'

export default combineReducers({
  workspaces: workspacesReducer,
  requestGroups: requestGroupsReducer,
  requests: requestsReducer,
  responses: responsesReducer,
  modals: modalsReducer,
  global: globalReducer,
  tabs: tabsReducer
});
