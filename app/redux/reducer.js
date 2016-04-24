import {combineReducers} from 'redux'

import workspacesReducer from './modules/workspaces'
import tabsReducer from './modules/tabs'
import globalReducer from './modules/global'
import modalsReducer from './modules/modals'

export default combineReducers({
  workspaces: workspacesReducer,
  modals: modalsReducer,
  global: globalReducer,
  tabs: tabsReducer
});
