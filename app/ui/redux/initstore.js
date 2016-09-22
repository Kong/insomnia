import {bindActionCreators} from 'redux';
import * as entitiesActions from './modules/entities';
import * as db from 'backend/database';

export function initStore (dispatch) {
  const entities = bindActionCreators(entitiesActions, dispatch);
  const handleNewChanges = entities.addChanges;

  console.log('-- Restoring Store --');

  const start = Date.now();
  db.offChange(handleNewChanges);

  // Restore docs in parent->child->grandchild order
  return Promise.all([
    db.settings.getOrCreate(),
    db.workspace.all(),
    db.environment.all(),
    db.cookieJar.all(),
    db.requestGroup.all(),
    db.request.all()
  ]).then(results => {
    for (let docs of results) {
      docs = Array.isArray(docs) ? docs : [docs];
      handleNewChanges(docs.map(doc => [db.CHANGE_UPDATE, doc]));
    }

    console.log(`-- Restored DB in ${(Date.now() - start) / 1000} s --`);
    db.onChange(handleNewChanges);
  });
}
