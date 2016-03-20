import * as types from '../constants/actionTypes'
import * as methods from '../constants/global'
import {loadStart} from "./global";
import {loadStop} from "./global";

function defaultRequest () {
  return {
    id: null,
    _mode: 'json',
    created: 0,
    modified: 0,
    name: '',
    method: methods.METHOD_GET,
    body: '',
    params: [],
    headers: [],
    authentication: {}
  }
}

/**
 * Build a new request from a subset of fields
 * @param request values to override defaults with
 * @returns {*}
 */
function buildRequest (request) {
  // Build the required fields
  const id = request.id || `rq_${Date.now()}`;
  const created = request.created || Date.now();
  const modified = request.modified || Date.now();

  // Create the request
  return Object.assign({}, defaultRequest(), request, {
    id, created, modified
  });
}

export function addRequest (name = 'My Request') {
  return (dispatch) => {
    dispatch(loadStart());
    const request = buildRequest({name});
    dispatch({type: types.REQUEST_ADD, request});

    return new Promise((resolve) => {
      setTimeout(() => {
        dispatch(loadStop());
        resolve();
      }, 500);
    });
  };
}

export function updateRequest (requestPatch) {
  return (dispatch) => {
    dispatch(loadStart());

    const request = Object.assign({}, requestPatch, {modified: Date.now()});
    dispatch({type: types.REQUEST_UPDATE, request});

    return new Promise((resolve) => {
      setTimeout(() => {
        dispatch(loadStop());
        resolve();
      }, 500);
    });
  };
}

export function activateRequest (request) {
  return {type: types.REQUEST_ACTIVATE, request: request};
}
