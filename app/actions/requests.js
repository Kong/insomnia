import * as types from '../constants/actionTypes'
import * as methods from '../constants/global'
import {loadStart, loadStop, showPrompt} from "./global";
import {REQUEST_RENAME} from "../constants/prompts";

const defaultRequest = {
  id: null,
  created: 0,
  modified: 0,
  url: '',
  name: '',
  method: methods.METHOD_GET,
  body: '',
  params: [],
  headers: [{
    name: 'Content-Type',
    value: 'application/json'
  }],
  authentication: {}
};

function buildRequest (request) {
  // Build the required fields
  const id = request.id || `rq_${Date.now()}`;
  const created = request.created || Date.now();
  const modified = request.modified || Date.now();

  // Create the request
  return Object.assign({}, defaultRequest, request, {
    id, created, modified
  });
}

export function addRequest (requestGroupId = null) {
  return (dispatch) => {
    dispatch(loadStart());
    const request = buildRequest({name: 'New Request'});
    dispatch({type: types.REQUEST_ADD, request});

    // HACK: Add request to group right away. Not sure how to get around this
    // TODO: Make this not need to know about RequestGroup actions
    if (requestGroupId) {
      const id = requestGroupId;
      const requestId = request.id;
      dispatch({type: types.REQUEST_GROUP_ADD_CHILD_REQUEST, requestId, id});
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        dispatch(loadStop());
        resolve();
      }, 500);
    });
  };
}

export function deleteRequest (id) {
  return (dispatch) => {
    dispatch(loadStart());
    dispatch({type: types.REQUEST_DELETE, id});

    return new Promise((resolve) => {
      setTimeout(() => {
        dispatch(loadStop());
        resolve();
      }, 500);
    });
  }
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

export function duplicateRequest (oldRequest, requestGroupId) {
  return (dispatch) => {
    dispatch(loadStart());
    const request = buildRequest(
      Object.assign({}, oldRequest, {id: null, name: `${oldRequest.name} Copy`})
    );
    dispatch({type: types.REQUEST_ADD, request});

    if (requestGroupId) {
      const id = requestGroupId;
      const requestId = request.id;
      dispatch({type: types.REQUEST_GROUP_ADD_CHILD_REQUEST, requestId, id});
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        dispatch(loadStop());
        resolve();
      }, 500);
    });
  };
}

export function updateRequestUrl (id, url) {
  return updateRequest({id, url});
}

export function updateRequestBody (id, body) {
  return updateRequest({id, body});
}

export function updateRequestMethod (id, method) {
  return updateRequest({id, method});
}

export function updateRequestName (id, name) {
  console.log('NEW NAME', id, name);
  return updateRequest({id, name});
}

export function activateRequest (id) {
  return {type: types.REQUEST_ACTIVATE, id};
}

export function changeFilter (filter) {
  return {type: types.REQUEST_CHANGE_FILTER, filter};
}

export function sendRequest (request) {
}

export function showRequestUpdateNamePrompt (id) {
  return showPrompt(REQUEST_RENAME, {id});
}
