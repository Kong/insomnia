const RESPONSE_UPDATE = 'responses/update';
const RESPONSE_REPLACE = 'responses/replace';

const initialState = {};

// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

export default function (state = initialState, action) {
  switch (action.type) {

    case RESPONSE_REPLACE:
      let newState = {};
      action.responses.map(r => {
        newState[r.parentId] = r
      });
      return newState;

    case RESPONSE_UPDATE:
      return Object.assign({}, state, {
        [action.response.parentId]: action.response
      });

    default:
      return state;
  }
}


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export function update (response) {
  return {type: RESPONSE_UPDATE, response};
}

export function replace (responses) {
  return {type: RESPONSE_REPLACE, responses};
}
