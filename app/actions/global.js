import * as types from '../constants/actionTypes';
import {LOCALSTORAGE_KEY} from "../constants/global";

export function loadStart () {
  return {type: types.GLOBAL_LOAD_START};
}

export function loadStop () {
  return {type: types.GLOBAL_LOAD_STOP};
}

export function selectTab (id, selectedIndex) {
  return {type: types.GLOBAL_SELECT_TAB, id, selectedIndex}
}

export function batchActions (actions) {
  return {type: types.GLOBAL_BATCH_ACTIONS, actions};
}
