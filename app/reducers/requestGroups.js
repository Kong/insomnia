import * as types from "../constants/actionTypes";

const initialState = {
  all: []
};

function requestGroupsReducer (state = [], action) {
  switch (action.type) {

    case types.REQUEST_GROUP_ADD:
      // Change name if there is a duplicate
      const requestGroup = action.requestGroup;
      for (let i = 0; ; i++) {
        let name = i === 0 ? requestGroup.name : requestGroup.name + ` (${i})`;
        if (!state.find(r => r.name === name)) {
          requestGroup.name = name;
          break;
        }
      }
      return [requestGroup, ...state];

    case types.REQUEST_GROUP_UPDATE:
      return state.map(rg => {
        if (rg.id === action.patch.id) {
          return Object.assign({}, rg, action.patch);
        } else {
          return rg;
        }
      });
    
    case types.REQUEST_GROUP_TOGGLE:
      return state.map(rg => {
        if (rg.id === action.id) {
          const collapsed = !rg.collapsed;
          return Object.assign({}, rg, {collapsed});
        } else {
          return rg;
        }
      });

    case types.REQUEST_GROUP_ADD_CHILD_REQUEST:
      return state.map(rg => {
        if (rg.id === action.id) {
          rg.children = [
            {type: 'Request', id: action.requestId},
            ...rg.children
          ];
        }
        return rg;
      });

    case types.REQUEST_GROUP_DELETE:
      return state.filter(rg => rg.id !== action.id);

    default:
      return state;
  }
}

export default function (state = initialState, action) {
  let all;
  switch (action.type) {

    case types.REQUEST_GROUP_ADD:
      all = requestGroupsReducer(state.all, action);
      return Object.assign({}, state, {all});

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
