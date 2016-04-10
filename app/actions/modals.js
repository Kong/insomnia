import * as types from '../constants/actionTypes';

export function hideModal (id) {
  return {type: types.MODAL_HIDE, id}
}

export function showModal (id, data = {}) {
  return {type: types.MODAL_SHOW, id, data};
}
