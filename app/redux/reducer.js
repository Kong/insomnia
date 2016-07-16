import {combineReducers} from 'redux';

import workspaces from './modules/workspaces';
import requestGroups from './modules/requestGroups';
import requests from './modules/requests';
import responses from './modules/responses';
import global from './modules/global';
import modals from './modules/modals';
import entities from './modules/entities';

export default combineReducers({
  workspaces,
  responses,
  requests,
  requestGroups,
  modals,
  global,
  entities
});
