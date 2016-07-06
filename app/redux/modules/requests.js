import {combineReducers} from 'redux'
import * as network from '../../lib/network'
import {show} from './modals'
import {MODAL_REQUEST_RENAME} from '../../lib/constants'

export const REQUEST_CHANGE_FILTER = 'requests/filter';
export const REQUEST_SEND_START = 'requests/start';
export const REQUEST_SEND_STOP = 'requests/stop';


// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

function filterReducer(state = '', action) {
  switch (action.type) {

    case REQUEST_CHANGE_FILTER:
      const filter = action.filter;
      return Object.assign({}, state, {filter});

    default:
      return state;
  }
}

function loadingRequestsReducer(state = {}, action) {
  let loadingRequests;
  switch (action.type) {

    case REQUEST_SEND_START:
      loadingRequests = Object.assign({}, state.loadingRequests);
      loadingRequests[action.requestId] = true;
      return Object.assign({}, state, {loadingRequests})

    case REQUEST_SEND_STOP:
      loadingRequests = Object.assign({}, state.loadingRequests);
      delete loadingRequests[action.requestId];
      return Object.assign({}, state, {loadingRequests})

    default:
      return state;
  }
}

export default combineReducers({
  filter: filterReducer,
  loadingRequests: loadingRequestsReducer
});


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export function changeFilter(filter) {
  return {type: REQUEST_CHANGE_FILTER, filter};
}

export function send(request) {
  return dispatch => {
    dispatch({type: REQUEST_SEND_START, requestId: request._id});

    network.send(request._id, () => {
      dispatch({type: REQUEST_SEND_STOP, requestId: request._id});
    });
  }
}

export function showUpdateNamePrompt(request) {
  const defaultValue = request.name;
  return show(MODAL_REQUEST_RENAME, {defaultValue, request});
}
