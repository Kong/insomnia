const MODAL_SHOW = 'modals/show';
const MODAL_HIDE = 'modals/hide';

const initialState = [];

// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

export default function (state = initialState, action) {
  switch (action.type) {

    case MODAL_SHOW:
      let id = action.id;
      let data = action.data;
      return [...state.filter(m => m.id !== action.id), {id, data}];

    case MODAL_HIDE:
      return state.filter(m => m.id !== action.id);

    default:
      return state
  }
}


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export function hide (id) {
  return {type: MODAL_HIDE, id}
}

export function show (id, data = {}) {
  return {type: MODAL_SHOW, id, data};
}

