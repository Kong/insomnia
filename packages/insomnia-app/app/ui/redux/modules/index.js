import { bindActionCreators, combineReducers } from 'redux';
import * as entities from './entities';
import configureStore from '../create';
import * as global from './global';
import * as db from '../../../common/database';
import * as models from '../../../models';
import { API_BASE_URL, getClientString } from '../../../common/constants';
import { isLoggedIn, onLoginLogout } from '../../../account/session';
import * as fetch from '../../../account/fetch';

export async function init() {
  const store = configureStore();

  // Do things that must happen before initial render
  const { addChanges, addChangesSync } = bindActionCreators(entities, store.dispatch);
  const { newCommand, loginStateChange } = bindActionCreators(global, store.dispatch);

  const allDocs = await getAllDocs();

  // Link DB changes to entities reducer/actions
  const changes = allDocs.map(doc => [db.CHANGE_UPDATE, doc]);
  addChangesSync(changes);
  db.onChange(addChanges);

  // Initialize login state
  loginStateChange(isLoggedIn());
  onLoginLogout(loggedIn => {
    loginStateChange(loggedIn);
  });

  // Bind to fetch commands
  fetch.setup(getClientString(), API_BASE_URL);
  fetch.onCommand(newCommand);

  store.dispatch(global.init());

  return store;
}

export const reducer = combineReducers({
  entities: entities.reducer,
  global: global.reducer,
});

/**
 * Async function to get all docs concurrently
 */
async function getAllDocs() {
  // Restore docs in parent->child->grandchild order
  const allDocs = [
    ...(await models.settings.all()),
    ...(await models.workspace.all()),
    ...(await models.workspaceMeta.all()),
    ...(await models.environment.all()),
    ...(await models.cookieJar.all()),
    ...(await models.requestGroup.all()),
    ...(await models.requestGroupMeta.all()),
    ...(await models.request.all()),
    ...(await models.requestMeta.all()),
    ...(await models.response.all()),
    ...(await models.oAuth2Token.all()),
    ...(await models.clientCertificate.all()),
  ];

  return allDocs;
}
