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
      return state.map(request => {
        if (request.id === action.request.id) {
          return Object.assign({}, request, action.request);
        } else {
          return request;
      }});
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
      active = state.active;
      active = active && active.id === action.request.id ? action.request : active;
      return Object.assign({}, state, {all, active});
    case types.REQUEST_ACTIVATE:
      active = action.request;
      return active ? Object.assign({}, state, {active}) : state;
    default:
      return state
  }
}
