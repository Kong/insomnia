import * as db from '../../../common/database';
import * as models from '../../../models';

const ENTITY_BLACKLIST = {
  [models.response.type]: 1,
  [models.stats.type]: 1
};

const ENTITY_CHANGES = 'entities/changes';

// ~~~~~~~~ //
// Reducers //
// ~~~~~~~~ //

function getReducerName (type) {
  const trailer = type.match(/s$/) ? '' : 's';
  return `${type.slice(0, 1).toLowerCase()}${type.slice(1)}${trailer}`;
}

const initialState = {};

for (const type of models.types()) {
  initialState[getReducerName(type)] = {};
}

export default function (state = initialState, action) {
  switch (action.type) {
    case ENTITY_CHANGES:
      const newState = Object.assign({}, state);
      const {changes} = action;

      for (const [event, doc] of changes) {
        const referenceName = getReducerName(doc.type);

        if (ENTITY_BLACKLIST[doc.type]) {
          continue;
        }

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

export function addChanges (changes) {
  return {type: ENTITY_CHANGES, changes};
}
