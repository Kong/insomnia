const TABS_SELECT = 'tabs/select';


// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

export default function (state = {}, action) {
  switch (action.type) {

    case TABS_SELECT:
      return Object.assign({}, state.tabs, {
        [action.id]: action.selectedIndex
      });

    default:
      return state;
  }
}


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export function select (id, selectedIndex) {
  return {type: TABS_SELECT, id, selectedIndex}
}

