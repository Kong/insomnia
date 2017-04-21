import {bindActionCreators, combineReducers} from 'redux';
import * as entities from './entities';
import configureStore from '../create';
import * as global from './global';
import * as db from '../../../common/database';
import * as models from '../../../models';
import * as fetch from '../../../common/fetch';

export async function init () {
  const store = configureStore();

  // Do things that must happen before initial render
  const {addChanges, addChangesSync} = bindActionCreators(entities, store.dispatch);
  const {newCommand} = bindActionCreators(global, store.dispatch);

  const allDocs = await getAllDocs();

  // Link DB changes to entities reducer/actions
  const changes = allDocs.map(doc => [db.CHANGE_UPDATE, doc]);
  addChangesSync(changes);
  db.onChange(addChanges);

  // Bind to fetch commands
  fetch.onCommand(newCommand);

  store.dispatch(global.init());

  return store;
}

export const reducer = combineReducers({
  entities: entities.reducer,
  global: global.reducer
});

/**
 * Async function to get all docs concurrently
 */
async function getAllDocs () {
  // Restore docs in parent->child->grandchild order
  const allQueryResults = await Promise.all([
    models.settings.all(),
    models.workspace.all(),
    models.workspaceMeta.all(),
    models.environment.all(),
    models.cookieJar.all(),
    models.requestGroup.all(),
    models.requestGroupMeta.all(),
    models.request.all(),
    models.requestMeta.all(),
    models.oAuth2Token.all()
  ]);

  // Aggregate all results into one big array
  const allDocs = [];
  for (const result of allQueryResults) {
    for (const doc of result) {
      allDocs.push(doc);
    }
  }

  return allDocs;
}
