import {bindActionCreators} from 'redux'
import * as entitiesActions from './modules/entities'
import * as db from '../database'

const CHANGE_ID = 'store.listener';

export function initStore (dispatch) {
  db.offChange(CHANGE_ID);

  const entities = bindActionCreators(entitiesActions, dispatch);

  const docChanged = (event, doc) => {
    if (!doc.hasOwnProperty('type')) {
      return;
    }

    if (event === 'insert') {
      entities.insert(doc);
    } else if (event === 'update') {
      entities.update(doc);
    } else if (event === 'delete') {
      entities.remove(doc);
    }
  };

  console.log('-- Restoring Store --');

  const start = Date.now();

  return db.workspaceAll().then(docs => {
    docs.map(doc => docChanged('update', doc));
    return db.requestGroupAll();
  }).then(docs => {
    docs.map(doc => docChanged('update', doc));
    return db.requestAll();
  }).then(docs => {
    docs.map(doc => docChanged('update', doc));
    return db.responseAll();
  }).then(docs => {
    docs.map(doc => docChanged('update', doc));
  }).then(() => {
    db.onChange(CHANGE_ID, docChanged);
  });
  //   const restoreChildren = (doc) => {
  //     docChanged(doc);
  //  
  //     return db.getChildren(doc).then(res => {
  //       // Done condition
  //       if (!res.docs.length) {
  //         return;
  //       }
  //  
  //       return Promise.all(
  //         res.docs.map(doc => restoreChildren(doc))
  //       );
  //     })
  //   };
  //  
  //   return res.docs.map(restoreChildren)
  // }).then(() => {
  //   console.log(`Restore took ${(Date.now() - start) / 1000} s`);
  // }).then(() => {
  //   db.onChange(CHANGE_ID, res => docChanged(res.doc));
  // });
}
