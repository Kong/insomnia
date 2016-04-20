import * as types from "../constants/actionTypes";

const initialState = {};

export default function (state = initialState, action) {
  switch (action.type) {

    case types.RESPONSE_UPDATE:
      const newState = Object.assign({}, state);
      newState[action.response.requestId] = action.response;
      return newState;
    
    default:
      return state
  }
}
