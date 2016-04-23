const RESPONSE_UPDATE = 'responses/update';

const initialState = {};

// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

export default function (state = initialState, action) {
  switch (action.type) {

    case RESPONSE_UPDATE:
      return Object.assign({}, state, {
        [action.response.requestId]: action.response
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
