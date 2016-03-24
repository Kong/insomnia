import * as types from "../constants/actionTypes";

const initialState = {
  all: [],
  collapsed: []
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
      return state.map(requestGroup => {
        if (requestGroup.id === action.patch.id) {
          return Object.assign({}, requestGroup, action.patch);
        } else {
          return requestGroup;
        }
      });
    default:
      return state;
  }
}

export default function (state = initialState, action) {
  let all, active;
  switch (action.type) {
    case types.REQUEST_GROUP_ADD:
      all = requestGroupsReducer(state.all, action);
      active = action.requestGroup.id;
      return Object.assign({}, state, {all, active});
    case types.REQUEST_GROUP_TOGGLE:
      let collapsed;
      if (state.collapsed.indexOf(action.id) >= 0) {
        // Remove it
        collapsed = state.collapsed.filter(id => id !== action.id);
      } else {
        // Add it
        collapsed = [...state.collapsed, action.id]
      }
      return Object.assign({}, state, {collapsed});
    case types.REQUEST_GROUP_UPDATE:
      all = requestGroupsReducer(state.all, action);
      return Object.assign({}, state, {all});
    default:
      return state
  }
}
