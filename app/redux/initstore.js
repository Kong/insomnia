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
    res.docs.map(docChanged);
  }).then(() => {
    return db.workspaceGetActive()
  }).then(res => {
    const workspace = res.docs.length ? res.docs[0] : db.workspaceCreate();

    const restoreChildren = (doc, maxDepth, depth = 0) => {
      docChanged(doc);

      return db.getChildren(doc).then(res => {
        return Promise.all(
          res.docs.map(doc => restoreChildren(doc, maxDepth, depth++))
        );
      })
    };

    return restoreChildren(workspace, 5);
  }).then(() => {
    console.log(`Restore took ${(Date.now() - start) / 1000} s`);
  }).then(() => {
    db.onChange(CHANGE_ID, res => docChanged(res.doc));
  });
}

