import * as types from '../constants/actionTypes';

export function hide (id) {
  return {type: types.MODAL_HIDE, id}
}

export function show (id, data = {}) {
  return {type: types.MODAL_SHOW, id, data};
}
