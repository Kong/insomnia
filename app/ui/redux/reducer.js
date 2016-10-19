import {combineReducers} from 'redux';

import requests from './modules/requests';
import global from './modules/global';
import entities from './modules/entities';

export default combineReducers({
  requests,
  global,
  entities
});
