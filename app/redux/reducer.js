import {combineReducers} from 'redux'

import workspaces from './modules/workspaces'
import tabs from './modules/tabs'
import global from './modules/global'
import modals from './modules/modals'
import entities from './modules/entities'

export default combineReducers({
  workspaces,
  modals,
  global,
  tabs,
  entities
});
