import * as types from '../constants/actionTypes'

const defaultRequestGroup = {
  id: null,
  created: 0,
  modified: 0,
  collapsed: false,
  name: '',
  environment: {},
  children: []
};

/**
 * Build a new request group from a subset of fields
 * @param requestGroup values to override defaults with
 * @returns {*}
 */
function buildRequestGroup (requestGroup) {
  // Build the required fields
  const id = requestGroup.id || `rg_${Date.now()}`;
  const created = requestGroup.created || Date.now();
  const modified = requestGroup.modified || Date.now();

  // Create the request
  return Object.assign({}, defaultRequestGroup, requestGroup, {
    id, created, modified
  });
}

export function addRequestGroup (name = 'New Group') {
  const requestGroup = buildRequestGroup({name});
  return {type: types.REQUEST_GROUP_ADD, requestGroup};
}

export function addChildRequest (id, requestId) {
  return {type: types.REQUEST_GROUP_ADD_CHILD_REQUEST, id, requestId};
}

export function updateRequestGroup (requestGroupPatch) {
  if (!requestGroupPatch.id) {
    throw new Error('Cannot update RequestGroup without id');
  }

  const modified = Date.now();
  const patch = Object.assign({}, requestGroupPatch, {modified});
  return {type: types.REQUEST_GROUP_UPDATE, patch};
}

export function deleteRequestGroup (id) {
  return {type: types.REQUEST_GROUP_DELETE, id};
}

export function updateRequestGroupName (id, name) {
  return updateRequest({id, name});
}

export function updateRequestGroupEnvironment (id, environment) {
  return updateRequest({id, environment});
}

export function toggleRequestGroup (id) {
  return {type: types.REQUEST_GROUP_TOGGLE, id}
}
