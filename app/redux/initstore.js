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

    if (event === db.EVENT_INSERT) {
      entities.insert(doc);
    } else if (event === db.EVENT_UPDATE) {
      entities.update(doc);
    } else if (event === db.EVENT_REMOVE) {
      entities.remove(doc);
    }
  };

  console.log('-- Restoring Store --');

  const start = Date.now();

  // Restore docs in parent->child->grandchild order
  return Promise.all([
    db.settingsGetOrCreate(),
    db.workspaceAll(),
    db.environmentAll(),
    db.cookieJarAll(),
    db.requestGroupAll(),
    db.requestAll()
  ]).then(results => {
    for (let docs of results) {
      docs = Array.isArray(docs) ? docs : [docs];

      for (let doc of docs) {
        docChanged(db.EVENT_UPDATE, doc);
      }
    }

    console.log(`-- Restored DB in ${(Date.now() - start) / 1000} s --`);
    db.onChange(CHANGE_ID, docChanged);
  });
}
