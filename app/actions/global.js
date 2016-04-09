import * as types from '../constants/actionTypes';
import {LOCALSTORAGE_KEY} from "../constants/global";

export function restoreState () {
  return (dispatch) => {
    setTimeout(() => {
      let state = undefined;
      try {
        state = JSON.parse(localStorage[LOCALSTORAGE_KEY]);
      } catch (e) { }

      dispatch({type: types.GLOBAL_STATE_RESTORED, state});
    }, 0);
  }
}

export function loadStart () {
  return {type: types.GLOBAL_LOAD_START};
}

export function loadStop () {
  return {type: types.GLOBAL_LOAD_STOP};
}

export function showPrompt (id, data) {
  return {type: types.GLOBAL_SHOW_PROMPT, id, data};
}

export function hidePrompt (id) {
  return {type: types.GLOBAL_HIDE_PROMPT, id};
}

export function selectTab (id, selectedIndex) {
  return {type: types.GLOBAL_SELECT_TAB, id, selectedIndex}
}
