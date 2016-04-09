import * as types from '../constants/actionTypes'
import * as methods from '../constants/global'
import makeRequest from '../lib/request'
import {loadStart, loadStop, showPrompt} from "./global"
import {REQUEST_RENAME} from "../constants/prompts"
import {setResponse} from "./responses";

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
  return dispatch => {
    const request = buildRequest({name: 'New Request'});
    dispatch({type: types.REQUEST_ADD, request});

    // HACK: Add request to group right away. Not sure how to get around this
    // TODO: Make this not need to know about RequestGroup actions
    if (requestGroupId) {
      const id = requestGroupId;
      const requestId = request.id;
      dispatch({type: types.REQUEST_GROUP_ADD_CHILD_REQUEST, requestId, id});
    }
  }
}

export function deleteRequest (id) {
  return {type: types.REQUEST_DELETE, id};
}

export function updateRequest (requestPatch) {
  if (!requestPatch.id) {
    throw new Error('Cannot update request without id');
  }

  const modified = Date.now();
  const patch = Object.assign({}, requestPatch, {modified});

  return {type: types.REQUEST_UPDATE, patch};
}

export function duplicateRequest (oldRequest, requestGroupId) {
  return dispatch => {
    const request = buildRequest(
      Object.assign({}, oldRequest, {id: null, name: `${oldRequest.name} Copy`})
    );
    dispatch({type: types.REQUEST_ADD, request});

    if (requestGroupId) {
      const id = requestGroupId;
      const requestId = request.id;
      dispatch({type: types.REQUEST_GROUP_ADD_CHILD_REQUEST, requestId, id});
    }
  }
}

export function activateRequest (id) {
  return {type: types.REQUEST_ACTIVATE, id};
}

export function changeFilter (filter) {
  return {type: types.REQUEST_CHANGE_FILTER, filter};
}

export function sendRequest (request) {
  return dispatch => {
    dispatch(loadStart());

    makeRequest(request, (err, response) => {
      if (err) {
        console.error(err);
      } else {
        console.log(response.statusCode, response.body);
      }

      dispatch(setResponse(request.id, {
        body: response.body,
        statusCode: response.statusCode
      }));
      
      dispatch(loadStop());
    });
  }
}

export function showRequestUpdateNamePrompt (request) {
  const id = request.id;
  const defaultValue = request.name;
  return showPrompt(REQUEST_RENAME, {id, defaultValue});
}
