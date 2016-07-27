import {combineReducers} from 'redux';

import workspaces from './modules/workspaces';
import requests from './modules/requests';
import global from './modules/global';
import modals from './modules/modals';
import entities from './modules/entities';

export default combineReducers({
  workspaces,
  requests,
  modals,
  global,
  entities
});
