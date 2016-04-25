import {bindActionCreators} from 'redux'
import * as entitiesActions from './modules/entities'
import * as db from '../database'

const CHANGE_ID = 'store.listener';

export function initStore (dispatch) {
  db.offChange(CHANGE_ID);

  // New stuff...
  const entities = bindActionCreators(entitiesActions, dispatch);

  const docChanged = doc => {
    if (!doc.hasOwnProperty('type')) {
      return;
    }

    // New stuff...
    entities[doc._deleted ? 'remove' : 'update'](doc);
  };

  console.log('-- Restoring Store --');

  const start = Date.now();

  return db.workspaceAll().then(res => {
    const restoreChildren = (doc) => {
      docChanged(doc);

      return db.getChildren(doc).then(res => {
        // Done condition
        if (!res.docs.length) {
          return;
        }
        
        return Promise.all(
          res.docs.map(doc => restoreChildren(doc))
        );
      })
    };

    return res.docs.map(restoreChildren)
  }).then(() => {
    console.log(`Restore took ${(Date.now() - start) / 1000} s`);
  }).then(() => {
    db.onChange(CHANGE_ID, res => docChanged(res.doc));
  });
}
