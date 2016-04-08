import * as types from '../constants/actionTypes';
import settingsReducer from './settings'
import requestsReducer from './requests'
import requestGroupsReducer from './requestGroups'

const initialState = {
  initialized: false,
  loading: false,
  prompt: null
};

export default function (state = initialState, action) {
  let prompt;
  switch (action.type) {
    case types.GLOBAL_STATE_SAVED:
      return state;
    case types.GLOBAL_STATE_RESTORED:
      return Object.assign({}, state, action.state, {initialized: true});
    case types.GLOBAL_LOAD_START:
      return Object.assign({}, state, {loading: true});
    case types.GLOBAL_LOAD_STOP:
      return Object.assign({}, state, {loading: false});
    case types.GLOBAL_SHOW_PROMPT:
      prompt = {id: action.id, data: action.data};
      return Object.assign({}, state, {prompt});
    case types.GLOBAL_HIDE_PROMPT:
      prompt = null;
      return Object.assign({}, state, {prompt});
    default:
      // Send everything else to the child reducers
      const settings = settingsReducer(state.settings, action);
      const requests = requestsReducer(state.requests, action);
      const requestGroups = requestGroupsReducer(state.requestGroups, action);

      return Object.assign({}, state, {
        settings,
        requests,
        requestGroups
      });
  }
};
