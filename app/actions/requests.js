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
    url: '',
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
  return Object.assign(defaultRequest(), request, {
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
  if (!requestPatch.id) {
    throw new Error('Cannot update request without id');
  }

  return (dispatch) => {
    dispatch(loadStart());

    const modified = Date.now();
    const patch = Object.assign({}, requestPatch, {modified});
    dispatch({type: types.REQUEST_UPDATE, patch});

    return new Promise((resolve) => {
      setTimeout(() => {
        dispatch(loadStop());
        resolve();
      }, 800);
    });
  };
}

export function updateRequestUrl (id, url) {
  return updateRequest({id, url});
}

export function updateRequestBody (id, body) {
  return updateRequest({id, body});
}

export function activateRequest (id) {
  return {type: types.REQUEST_ACTIVATE, id};
}
