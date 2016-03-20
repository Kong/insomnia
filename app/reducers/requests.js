import * as types from "../constants/actionTypes";

const initialState = {
  all: [],
  active: null
};

function requestsReducer (state = [], action) {
  switch (action.type) {
    case types.REQUEST_ADD:
      return [...state, action.request];
    case types.REQUEST_UPDATE:
      return state.map(request => request.id === action.request.id ? action.request : request);
    default:
      return state;
  }
}

export default function (state = initialState, action) {
  let all, active;
  switch (action.type) {
    case types.REQUEST_ADD:
      all = requestsReducer(state.all, action);
      active = state.active || action.request;
      return Object.assign({}, state, {all, active});
    case types.REQUEST_UPDATE:
      all = requestsReducer(state.all, action);
      active = state.active.id === action.request.id ? action.request : state.active;
      return Object.assign({}, state, {all, active});
    default:
      return state
  }
}
