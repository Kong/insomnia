const GLOBAL_LOAD_START = 'global/load-start';
const GLOBAL_LOAD_STOP = 'global/load-stop';

const initialState = {
  loading: false
};


// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

export default function (state = initialState, action) {
  switch (action.type) {

    case GLOBAL_LOAD_START:
      return Object.assign({}, state, {loading: true});

    case GLOBAL_LOAD_STOP:
      return Object.assign({}, state, {loading: false});

    default:
      return state;
  }
}


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export function loadStart () {
  return {type: GLOBAL_LOAD_START};
}

export function loadStop () {
  return {type: GLOBAL_LOAD_STOP};
}
