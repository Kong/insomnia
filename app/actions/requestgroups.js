import * as types from '../constants/actionTypes'
import {loadStart} from "./global";
import {loadStop} from "./global";

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
  return (dispatch) => {
    dispatch(loadStart());
    const requestGroup = buildRequestGroup({name});
    dispatch({type: types.REQUEST_GROUP_ADD, requestGroup});

    return new Promise((resolve) => {
      setTimeout(() => {
        dispatch(loadStop());
        resolve();
      }, 500);
    });
  };
}

export function addChildRequest (id, requestId) {
  return (dispatch) => {
    dispatch(loadStart());
    dispatch({type: types.REQUEST_GROUP_ADD_CHILD_REQUEST, id, requestId});

    return new Promise((resolve) => {
      setTimeout(() => {
        dispatch(loadStop());
        resolve();
      }, 500);
    });
  };
}

export function updateRequestGroup (requestGroupPatch) {
  if (!requestGroupPatch.id) {
    throw new Error('Cannot update RequestGroup without id');
  }

  return (dispatch) => {
    dispatch(loadStart());

    const modified = Date.now();
    const patch = Object.assign({}, requestGroupPatch, {modified});
    dispatch({type: types.REQUEST_GROUP_UPDATE, patch});

    return new Promise((resolve) => {
      setTimeout(() => {
        dispatch(loadStop());
        resolve();
      }, 800);
    });
  };
}

export function deleteRequestGroup (id) {
  return (dispatch) => {
    dispatch(loadStart());

    dispatch({type: types.REQUEST_GROUP_DELETE, id});

    return new Promise((resolve) => {
      setTimeout(() => {
        dispatch(loadStop());
        resolve();
      }, 800);
    });
  };
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
