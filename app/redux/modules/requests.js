import {combineReducers} from 'redux'

import * as network from '../../lib/network'
import {loadStart, loadStop} from './global'
import {show} from './modals'
import {MODAL_REQUEST_RENAME} from '../../lib/constants'

export const REQUEST_UPDATE = 'requests/update';
export const REQUEST_DELETE = 'requests/delete';
export const REQUEST_CHANGE_FILTER = 'requests/filter';

// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

function allReducer (state = [], action) {
  switch (action.type) {

    case REQUEST_DELETE:
      return state.filter(r => r._id !== action.request._id);

    case REQUEST_UPDATE:
      const i = state.findIndex(r => r._id === action.request._id);

      if (i === -1) {
        return [action.request, ...state];
      } else {
        return [...state.slice(0, i), action.request, ...state.slice(i + 1)]
      }

    default:
      return state;
  }
}

function filterReducer (state = '', action) {
  switch (action.type) {
    
    case REQUEST_CHANGE_FILTER:
      return action.filter;
    
    default:
      return state;
  }
}

function activeReducer (state = null, action) {
  switch (action.type) {

    case REQUEST_UPDATE:
      if (state && state._id === action.request._id) {
        // Update the currently active request
        return action.request;
      } else if (state) {
        // Activate a new request
        return action.request.activated > state.activated ? action.request : state;
      } else if (action.request.activated > 0) {
        // Activate request if there isn't one
        return action.request;
      } else {
        return state;
      }

    case REQUEST_DELETE:
      return state && state._id === action.request._id ? null : state;
   
    default:
      return state;
  }
}

export default combineReducers({
  all: allReducer,
  filter: filterReducer,
  active: activeReducer
});


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export function remove (request) {
  return {type: REQUEST_DELETE, request};
}

export function update (request) {
  return {type: REQUEST_UPDATE, request};
}

export function changeFilter (filter) {
  return {type: REQUEST_CHANGE_FILTER, filter};
}

export function send (request) {
  return dispatch => {
    dispatch(loadStart());

    network.send(request, () => {
      dispatch(loadStop());
    });
  }
}

export function showUpdateNamePrompt (request) {
  const defaultValue = request.name;
  return show(MODAL_REQUEST_RENAME, {defaultValue, request});
}
