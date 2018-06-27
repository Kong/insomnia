import * as db from '../../../common/database';
import * as models from '../../../models';

const ENTITY_CHANGES = 'entities/changes';

// ~~~~~~~~ //
// Reducers //
// ~~~~~~~~ //

function getReducerName(type) {
  const trailer = type.match(/s$/) ? '' : 's';
  return `${type.slice(0, 1).toLowerCase()}${type.slice(1)}${trailer}`;
}

const initialState = {};

for (const type of models.types()) {
  initialState[getReducerName(type)] = {};
}

export function reducer(state = initialState, action) {
  switch (action.type) {
    case ENTITY_CHANGES:
      const newState = Object.assign({}, state);
      const { changes } = action;

      for (const [event, doc] of changes) {
        const referenceName = getReducerName(doc.type);

        switch (event) {
          case db.CHANGE_INSERT:
          case db.CHANGE_UPDATE:
            newState[referenceName][doc._id] = doc;
            break;

          case db.CHANGE_REMOVE:
            delete newState[referenceName][doc._id];
            break;

          default:
            break;
        }
      }

      return newState;
    default:
      return state;
  }
}

// ~~~~~~~ //
// Actions //
// ~~~~~~~ //

export function addChanges(changes) {
  return dispatch => {
    setTimeout(() => {
      dispatch(addChangesSync(changes));
    });
  };
}

export function addChangesSync(changes) {
  return { type: ENTITY_CHANGES, changes };
}
