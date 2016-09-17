import {combineReducers} from 'redux';

import workspaces from './modules/workspaces';
import requests from './modules/requests';
import global from './modules/global';
import entities from './modules/entities';

export default combineReducers({
  workspaces,
  requests,
  global,
  entities
});
