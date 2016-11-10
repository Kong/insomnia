import {combineReducers} from 'redux';

import * as network from '../../../common/network';
import {trackEvent, trackLegacyEvent} from '../../../analytics';

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

export function send(request, environmentId) {
  return async function (dispatch) {
    dispatch({type: REQUEST_SEND_START, requestId: request._id});

    trackEvent('Request', 'Send');
    trackLegacyEvent('Request Send');

    try {
      await network.send(request._id, environmentId);
      dispatch({type: REQUEST_SEND_STOP, requestId: request._id});
    } catch (e) {
      // console.info('Error sending request', e);
      dispatch({type: REQUEST_SEND_STOP, requestId: request._id});
    }
  }
}
