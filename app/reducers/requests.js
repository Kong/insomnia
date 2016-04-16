import * as types from "../constants/actionTypes";

const initialState = {
  all: [],
  active: null,
  filter: ''
};

function requestsReducer (state = [], action) {
  switch (action.type) {
    
    case types.REQUEST_DELETE:
      return state.filter(r => r._id !== action.request._id);

    case types.REQUEST_UPDATE:
      const request = state.find(r => r._id === action.request._id);
      if (request) {
        return state.map(request => {
          if (request._id === action.request._id) {
            return Object.assign({}, request, action.request);
          } else {
            return request;
          }
        });
      } else {
        return [action.request, ...state];
      }
    default:
      return state;
  }
}

export default function (state = initialState, action) {
  let all, active;
  
  switch (action.type) {

    case types.REQUEST_DELETE:
      all = requestsReducer(state.all, action);
      active = state.active === action._id ? null : state.active;
      return Object.assign({}, state, {all, active});

    case types.REQUEST_UPDATE:
      all = requestsReducer(state.all, action);
      return Object.assign({}, state, {all});

    case types.REQUEST_ACTIVATE:
      if (state.active === action.request._id) {
        // If it's the same, do nothing
        return state;
      } else if (!state.all.find(r => r._id === action.request._id)) {
        // Don't set if the request doesn't exist
        return state;
      } else {
        return Object.assign({}, state, {active: action.request._id});
      }
          
    case types.REQUEST_CHANGE_FILTER:
      return Object.assign({}, state, {filter: action.filter});
    
    default:
      return state
  }
}
