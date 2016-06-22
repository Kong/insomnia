const LOAD_START = 'global/load-start';
const LOAD_STOP = 'global/load-stop';
const SIDEBAR_RESIZE = 'global/sidebar-resize';

const initialState = {
  loading: false
};


// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

export default function (state = initialState, action) {
  switch (action.type) {

    case LOAD_START:
      return Object.assign({}, state, {loading: true});

    case LOAD_STOP:
      return Object.assign({}, state, {loading: false});

    default:
      return state;
  }
}


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export function loadStart () {
  return {type: LOAD_START};
}

export function loadStop () {
  return {type: LOAD_STOP};
}
