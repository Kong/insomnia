import {combineReducers} from 'redux';

import {trackEvent} from '../../../backend/analytics';
import * as network from '../../../backend/network';

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
  let newState;
  switch (action.type) {

    case REQUEST_SEND_START:
      newState = Object.assign({}, state);
      newState[action.requestId] = Date.now();
      return newState;

    case REQUEST_SEND_STOP:
      newState = Object.assign({}, state);
      delete newState[action.requestId];
      return newState;

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

export function send(request) {
  return async function (dispatch) {
    dispatch({type: REQUEST_SEND_START, requestId: request._id});

    trackEvent('Request Send');

    try {
      await network.send(request._id);
      dispatch({type: REQUEST_SEND_STOP, requestId: request._id});
    } catch (e) {
      // console.info('Error sending request', e);
      dispatch({type: REQUEST_SEND_STOP, requestId: request._id});
    }
  }
}
