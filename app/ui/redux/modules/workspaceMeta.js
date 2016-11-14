import {combineReducers} from 'redux';

const LOCALSTORAGE_PREFIX = `insomnia::workspaces::meta`;

const SET_PANE_WIDTH = 'workspaces/pane-width';
const SET_ACTIVE_REQUEST = 'workspaces/active-request';
const SET_ACTIVE_ENVIRONMENT = 'workspaces/active-environment';
const SET_SIDEBAR_FILTER = 'workspaces/sidebar-filter';
const SET_SIDEBAR_HIDDEN = 'workspaces/sidebar-hidden';
const SET_SIDEBAR_WIDTH = 'workspaces/sidebar-width';


// ~~~~~~~~ //
// Reducers //
// ~~~~~~~~ //

export default combineReducers({
  ..._makePropertyReducer(SET_ACTIVE_REQUEST, 'activeRequestIds', 'requestId'),
  ..._makePropertyReducer(SET_ACTIVE_ENVIRONMENT, 'activeEnvironmentIds', 'environmentId'),
  ..._makePropertyReducer(SET_SIDEBAR_FILTER, 'sidebarFilters', 'filter'),
  ..._makePropertyReducer(SET_SIDEBAR_HIDDEN, 'sidebarHiddens', 'hidden'),
  ..._makePropertyReducer(SET_SIDEBAR_WIDTH, 'sidebarWidths', 'width'),
  ..._makePropertyReducer(SET_PANE_WIDTH, 'paneWidths', 'width'),
});


// ~~~~~~~ //
// Actions //
// ~~~~~~~ //

export function setPaneWidth (workspaceId, width) {
  _setMeta(workspaceId, 'paneWidths', width);
  return {type: SET_PANE_WIDTH, workspaceId, width};
}

export function setActiveRequest (workspaceId, requestId) {
  _setMeta(workspaceId, 'activeRequestIds', requestId);
  return {type: SET_ACTIVE_REQUEST, workspaceId, requestId};
}

export function setActiveEnvironment (workspaceId, environmentId) {
  _setMeta(workspaceId, 'activeEnvironmentIds', environmentId);
  return {type: SET_ACTIVE_ENVIRONMENT, workspaceId, environmentId};
}

export function setSidebarWidth (workspaceId, width) {
  _setMeta(workspaceId, 'sidebarWidths', width);
  return {type: SET_SIDEBAR_WIDTH, workspaceId, width};
}

export function setSidebarHidden (workspaceId, hidden) {
  _setMeta(workspaceId, 'sidebarHiddens', hidden);
  return {type: SET_SIDEBAR_HIDDEN, workspaceId, hidden};
}

export function setSidebarFilter (workspaceId, filter) {
  _setMeta(workspaceId, 'sidebarFilters', filter);
  return {type: SET_SIDEBAR_FILTER, workspaceId, filter};
}

export function init () {
  return function (dispatch) {
    const meta = _loadMeta();

    function callAction (key, fn) {
      if (!meta[key]) {
        return;
      }

      for (const workspaceId of Object.keys(meta[key])) {
        dispatch(fn(workspaceId, meta[key][workspaceId]));
      }
    }

    callAction('paneWidths', setPaneWidth);
    callAction('activeRequestIds', setActiveRequest);
    callAction('activeEnvironmentIds', setActiveEnvironment);
    callAction('sidebarHiddens', setSidebarHidden);
    callAction('sidebarWidths', setSidebarWidth);
    callAction('sidebarFilters', setSidebarFilter);
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
      [action.workspaceId]: action[actionValueKey]
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

export function _setMeta (workspaceId, key, value) {

  // Do this async so it doesn't crash anything
  process.nextTick(() => {
    const meta = _loadMeta();

    if (!meta.hasOwnProperty(key)) {
      meta[key] = {};
    }

    if (!meta[key].hasOwnProperty(workspaceId)) {
      meta[key][workspaceId] = {};
    }

    meta[key][workspaceId] = value;

    const metaJSON = JSON.stringify(meta, null, 2);
    localStorage.setItem(LOCALSTORAGE_PREFIX, metaJSON);
  });
}
