import * as types from "../constants/actionTypes";

const initialState = {
  all: []
};

function requestGroupsReducer (state = [], action) {
  switch (action.type) {

    case types.REQUEST_GROUP_UPDATE:
      const requestGroup = state.find(r => r._id === action.requestGroup._id);
      if (requestGroup) {
        return state.map(requestGroup => {
          if (requestGroup._id === action.requestGroup._id) {
            return Object.assign({}, requestGroup, action.requestGroup);
          } else {
            return requestGroup;
          }
        });
      } else {
        return [action.requestGroup, ...state];
      }
    
    case types.REQUEST_GROUP_TOGGLE:
      return state.map(rg => {
        if (rg._id === action._id) {
          const collapsed = !rg.collapsed;
          return Object.assign({}, rg, {collapsed});
        } else {
          return rg;
        }
      });

    case types.REQUEST_GROUP_DELETE:
      return state.filter(rg => rg._id !== action.requestGroup._id);

    default:
      return state;
  }
}

export default function (state = initialState, action) {
  let all;
  switch (action.type) {

    case types.REQUEST_GROUP_ADD_CHILD_REQUEST:
      all = requestGroupsReducer(state.all, action);
      return Object.assign({}, state, {all});

    case types.REQUEST_GROUP_TOGGLE:
      all = requestGroupsReducer(state.all, action);
      return Object.assign({}, state, {all});

    case types.REQUEST_GROUP_UPDATE:
      all = requestGroupsReducer(state.all, action);
      return Object.assign({}, state, {all});
    
    case types.REQUEST_GROUP_DELETE:
      all = requestGroupsReducer(state.all, action);
      return Object.assign({}, state, {all});
    
    default:
      return state
  }
}
