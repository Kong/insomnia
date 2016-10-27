import {combineReducers} from 'redux';

import {trackLegacyEvent} from '../../../backend/analytics';
import * as network from '../../../backend/network';
import {trackEvent} from '../../../backend/ganalytics';

export const REQUEST_SEND_START = 'requests/start';
export const REQUEST_SEND_STOP = 'requests/stop';


// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

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
  loadingRequests: loadingRequestsReducer,
  doNotPersist: () => true,
});


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export function send(request) {
  return async function (dispatch) {
    dispatch({type: REQUEST_SEND_START, requestId: request._id});

    trackEvent('Request', 'Send');
    trackLegacyEvent('Request Send');

    try {
      await network.send(request._id);
      dispatch({type: REQUEST_SEND_STOP, requestId: request._id});
    } catch (e) {
      // console.info('Error sending request', e);
      dispatch({type: REQUEST_SEND_STOP, requestId: request._id});
    }
  }
}
