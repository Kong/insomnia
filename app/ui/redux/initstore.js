import {bindActionCreators} from 'redux';
import * as entitiesActions from './modules/entities';
import * as globalActions from './modules/global';
import * as db from '../../backend/database';
import * as fetch from '../../backend/fetch';

export async function initStore (dispatch) {
  const entities = bindActionCreators(entitiesActions, dispatch);
  const global = bindActionCreators(globalActions, dispatch);
  const handleNewChanges = entities.addChanges;
  const handleCommand = global.newCommand;

  console.log('-- Restoring Store --');

  const start = Date.now();

  db.offChange(handleNewChanges);
  fetch.offCommand(handleCommand);

  // Restore docs in parent->child->grandchild order
  const results = [
    await db.settings.getOrCreate(),
    await db.workspace.all(),
    await db.environment.all(),
    await db.cookieJar.all(),
    await db.requestGroup.all(),
    await db.request.all()
  ];

  for (let docs of results) {
    docs = Array.isArray(docs) ? docs : [docs];
    handleNewChanges(docs.map(doc => [db.CHANGE_UPDATE, doc]));
  }

  console.log(`-- Restored DB in ${(Date.now() - start) / 1000} s --`);
  db.onChange(handleNewChanges);
  fetch.onCommand(handleCommand);
}
