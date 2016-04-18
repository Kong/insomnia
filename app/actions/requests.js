import * as types from '../constants/actionTypes'
import makeRequest from '../lib/request'
import {loadStart, loadStop} from './global'
import * as modals from './modals'
import {REQUEST_RENAME} from '../constants/modals'

export function remove (request) {
  return {type: types.REQUEST_DELETE, request};
}

export function update (request) {
  return {type: types.REQUEST_UPDATE, request};
}

export function activate (request) {
  return {type: types.REQUEST_ACTIVATE, request};
}

export function changeFilter (filter) {
  return {type: types.REQUEST_CHANGE_FILTER, filter};
}

export function send (request) {
  return dispatch => {
    dispatch(loadStart());

    makeRequest(request, () => {
      dispatch(loadStop());
    });
  }
}

export function showUpdateNamePrompt (request) {
  const defaultValue = request.name;
  return modals.show(REQUEST_RENAME, {defaultValue, request});
}
