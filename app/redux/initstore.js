import {bindActionCreators} from 'redux';
import * as entitiesActions from './modules/entities';
import * as db from '../database';

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
    } else if (event === 'remove') {
      entities.remove(doc);
    }
  };

  console.log('-- Restoring Store --');

  const start = Date.now();

  // Restore docs in parent->child->grandchild order
  return db.settingsGet().then(doc => {
    docChanged('update', doc);
    return db.workspaceAll();
  }).then(docs => {
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
    console.log(`-- Restored DB in ${(Date.now() - start) / 1000} s --`);
  }).then(() => {
    db.onChange(CHANGE_ID, docChanged);
  });
}
