import * as types from "../constants/actionTypes";

const initialState = {
  all: [],
  active: null
};

function requestsReducer (state = [], action) {
  switch (action.type) {
    case types.REQUEST_ADD:

      // Change name if there is a duplicate
      const request = action.request;
      for (let i = 0; ; i++) {
        let name = i === 0 ? request.name : request.name + ` (${i})`;
        if (!state.find(r => r.name === name)) {
          request.name = name;
          break;
        }
      }

      return [...state, request];
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
  let all, active;
  switch (action.type) {
    case types.REQUEST_ADD:
      all = requestsReducer(state.all, action);
      active = state.active || action.request.id;
      return Object.assign({}, state, {all, active});
    case types.REQUEST_UPDATE:
      all = requestsReducer(state.all, action);
      return Object.assign({}, state, {all});
    case types.REQUEST_ACTIVATE:
      if (!state.all.find(r => r.id === action.id)) {
        // Don't set if the request doesn't exist
        return state;
      } else {
        return Object.assign({}, state, {active: action.id});
      }
    default:
      return state
  }
}
