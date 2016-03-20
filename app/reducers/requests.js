import * as types from "../constants/actionTypes";

const initialState = {
  all: [],
  activeId: null
};

function requestsReducer (state = [], action) {
  switch (action.type) {
    case types.REQUEST_ADD:
      return [...state, action.request];
    case types.REQUEST_UPDATE:
      return state.map(request => {
        if (request.id === action.patch.id) {
          return Object.assign({}, request, action.patch);
        } else {
          return request;
      }});
    default:
      return state;
  }
}

export default function (state = initialState, action) {
  let all, activeId;
  switch (action.type) {
    case types.REQUEST_ADD:
      all = requestsReducer(state.all, action);
      activeId = state.activeId || action.request.id;
      return Object.assign({}, state, {all, activeId});
    case types.REQUEST_UPDATE:
      all = requestsReducer(state.all, action);
      return Object.assign({}, state, {all});
    case types.REQUEST_ACTIVATE:
      if (!state.all.find(r => r.id === action.id)) {
        // Don't set if the request doesn't exist
        return state;
      } else {
        return Object.assign({}, state, {activeId: action.id});
      }
    default:
      return state
  }
}
