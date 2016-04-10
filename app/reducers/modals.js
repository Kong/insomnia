import * as types from '../constants/actionTypes';

const initialState = [];

export default function (state = initialState, action) {
  switch (action.type) {
    
    case types.MODAL_SHOW:
      let id = action.id;
      let data = action.data;
      return [...state.filter(m => m.id !== action.id), {id, data}];
    
    case types.MODAL_HIDE:
      return state.filter(m => m.id !== action.id);
    
    default:
      return state
  }
}
