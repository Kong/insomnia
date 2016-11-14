import {combineReducers} from 'redux';

const LOCALSTORAGE_PREFIX = `insomnia::requestGroups::meta`;

const SET_COLLAPSED = 'requestGroups/collapsed';


// ~~~~~~~~ //
// Reducers //
// ~~~~~~~~ //

export default combineReducers({
  ..._makePropertyReducer(SET_COLLAPSED, 'collapsed', 'collapsed'),
});


// ~~~~~~~ //
// Actions //
// ~~~~~~~ //

export function setCollapsed (requestGroupId, collapsed) {
  _setMeta(requestGroupId, 'collapsed', collapsed);
  return {type: SET_COLLAPSED, requestGroupId, collapsed};
}

export function init () {
  return function (dispatch) {
    const meta = _loadMeta();

    function callAction (key, fn) {
      if (!meta[key]) {
        return;
      }

      for (const requestGroupId of Object.keys(meta[key])) {
        dispatch(fn(requestGroupId, meta[key][requestGroupId]));
      }
    }

    callAction('collapsed', setCollapsed);
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
      [action.requestGroupId]: action[actionValueKey]
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

export function _setMeta (requestGroupId, key, value) {
  const meta = _loadMeta();

  if (!meta.hasOwnProperty(key)) {
    meta[key] = {};
  }

  if (!meta[key].hasOwnProperty(requestGroupId)) {
    meta[key][requestGroupId] = {};
  }

  meta[key][requestGroupId] = value;

  const metaJSON = JSON.stringify(meta, null, 2);
  localStorage.setItem(LOCALSTORAGE_PREFIX, metaJSON);
}
