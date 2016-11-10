import * as db from '../../../backend/database';
import * as models from '../../../backend/models';

const ENTITY_BLACKLIST = {
  [models.response.type]: 1,
  [models.stats.type]: 1
};

const ENTITY_CHANGES = 'entities.changes';

// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

function getReducerName (type) {
  const trailer = type.match(/s$/) ? '' : 's';
  return `${type.slice(0, 1).toLowerCase()}${type.slice(1)}${trailer}`;
}

const initialState = {
  doNotPersist: true
};

for (const type of models.types()) {
  initialState[getReducerName(type)] = {};
}

export default function reducer (state = initialState, action) {
  switch (action.type) {
    case ENTITY_CHANGES:
      const newState = {...state};
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
// ACTIONS //
// ~~~~~~~ //

export function addChanges (changes) {
  return {type: ENTITY_CHANGES, changes};
}
