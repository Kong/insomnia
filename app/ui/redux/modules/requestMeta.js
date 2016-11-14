import {combineReducers} from 'redux';
import {trackEvent, trackLegacyEvent} from '../../../analytics';
import * as network from '../../../common/network';

const LOCALSTORAGE_PREFIX = 'insomnia::requests::meta';

const START_LOADING = 'requests/start-loading';
const STOP_LOADING = 'requests/stop-loading';
const SET_PREVIEW_MODE = 'requests/preview-mode';
const SET_RESPONSE_FILTER = 'requests/response-filter';


// ~~~~~~~~ //
// Reducers //
// ~~~~~~~~ //

export default combineReducers({
  loadingRequestIds: loadingReducer,
  ..._makePropertyReducer(SET_PREVIEW_MODE, 'previewModes', 'previewMode'),
  ..._makePropertyReducer(SET_RESPONSE_FILTER, 'responseFilters', 'filter'),
});

function loadingReducer (state = {}, action) {
  switch (action.type) {
    case START_LOADING:
      return Object.assign({}, state, {[action.requestId]: action.time});
    case STOP_LOADING:
      return Object.assign({}, state, {[action.requestId]: -1});
    default:
      return state;
  }
}


// ~~~~~~~ //
// Actions //
// ~~~~~~~ //

export function startLoading (requestId) {
  return {type: START_LOADING, requestId, time: Date.now()};
}

export function stopLoading (requestId) {
  return {type: STOP_LOADING, requestId};
}

export function setPreviewMode (requestId, previewMode) {
  _setMeta(requestId, 'previewModes', previewMode);
  return {type: SET_PREVIEW_MODE, requestId, previewMode};
}

export function setResponseFilter (requestId, filter) {
  _setMeta(requestId, 'responseFilters', filter);
  return {type: SET_RESPONSE_FILTER, requestId, filter};
}

export function send(requestId, environmentId) {
  return async function (dispatch) {
    dispatch(startLoading(requestId));

    trackEvent('Request', 'Send');
    trackLegacyEvent('Request Send');

    try {
      await network.send(requestId, environmentId);
    } catch (e) {
      // It's OK
    }

    dispatch(stopLoading(requestId));
  }
}

export function init () {
  return function (dispatch) {
    const meta = _loadMeta();

    function callAction (key, fn) {
      if (!meta[key]) {
        return;
      }

      for (const requestId of Object.keys(meta[key])) {
        dispatch(fn(requestId, meta[key][requestId]));
      }
    }

    callAction('previewModes', setPreviewMode);
    callAction('responseFilters', setResponseFilter);
  }
}


// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //

function _makePropertyReducer (actionType, stateKey, actionValueKey) {
  const fn = function (state = {}, action) {
    if (action.type !== actionType) {
      return state;
    }

    return Object.assign({}, state, {
      [action.requestId]: action[actionValueKey]
    });
  };

  return {[stateKey]: fn};
}

export function _loadMeta () {
  let meta = {};

  try {
    meta = JSON.parse(localStorage.getItem(LOCALSTORAGE_PREFIX) || '{}');
  } catch (e) {
    // Nothing here...
  }

  return meta || {};
}

export function _setMeta (requestId, key, value) {

  // Do this async so it doesn't crash anything
  process.nextTick(() => {
    const meta = _loadMeta();

    if (!meta.hasOwnProperty(key)) {
      meta[key] = {};
    }

    if (!meta[key].hasOwnProperty(requestId)) {
      meta[key][requestId] = {};
    }

    meta[key][requestId] = value;

    const metaJSON = JSON.stringify(meta, null, 2);
    localStorage.setItem(LOCALSTORAGE_PREFIX, metaJSON);
  });
}
