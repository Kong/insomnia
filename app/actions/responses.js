import * as types from '../constants/actionTypes'
import * as methods from '../constants/global'
import makeRequest from '../lib/request'
import {loadStart, loadStop, showPrompt} from "./global"
import {REQUEST_RENAME} from "../constants/prompts"

const defaultResponse = {
  id: null,
  requestId: null,
  created: 0,
  modified: 0,
  body: '',
  statusCode: -1,
  headers: [{
    name: 'Content-Type',
    value: 'application/json'
  }]
};

function buildResponse (response) {
  // Build the required fields
  const id = response.id || `rsp_${Date.now()}`;
  const created = response.created || Date.now();
  const modified = response.modified || Date.now();

  // Create the response
  return Object.assign({}, defaultResponse, response, {
    id, created, modified
  });
}

export function setResponse (requestId, response) {
  response.requestId = requestId;
  response = buildResponse(response);
  return {type: types.RESPONSE_SET, requestId, response}
}
