import * as network from '../../lib/network'
import {loadStart, loadStop} from './global'
import {show} from './modals'
import {MODAL_REQUEST_RENAME} from '../../lib/constants'

export const REQUEST_CHANGE_FILTER = 'requests/filter';

const initialState = {
  filter: ''
};

// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

export default function (state = initialState, action) {
  switch (action.type) {
    
    case REQUEST_CHANGE_FILTER:
      const filter = action.filter;
      return Object.assign({}, state, {filter});
    
    default:
      return state;
  }
}


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export function changeFilter (filter) {
  return {type: REQUEST_CHANGE_FILTER, filter};
}

export function send (request) {
  return dispatch => {
    dispatch(loadStart());

    network.send(request._id, () => {
      dispatch(loadStop());
    });
  }
}

export function showUpdateNamePrompt (request) {
  const defaultValue = request.name;
  return show(MODAL_REQUEST_RENAME, {defaultValue, request});
}
