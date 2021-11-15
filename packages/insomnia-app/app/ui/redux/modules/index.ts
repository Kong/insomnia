import { bindActionCreators, combineReducers, Store } from 'redux';

import * as fetch from '../../../account/fetch';
import { isLoggedIn, onLoginLogout } from '../../../account/session';
import { API_BASE_URL, getClientString } from '../../../common/constants';
import { database as db } from '../../../common/database';
import configureStore from '../create';
import * as entities from './entities';
import * as global from './global';

export async function init(): Promise<Store> {
  const store = configureStore();
  // Do things that must happen before initial render
  const { addChanges, initializeWith: initEntities } = bindActionCreators({ addChanges: entities.addChanges, initializeWith: entities.initializeWith }, store.dispatch);

  // @ts-expect-error -- TSCONVERSION
  const { newCommand, loginStateChange } = bindActionCreators(global, store.dispatch);
  // Link DB changes to entities reducer/actions
  const docs = await entities.allDocs();
  initEntities(docs);
  db.onChange(addChanges);
  // Initialize login state
  loginStateChange(isLoggedIn());
  onLoginLogout(loggedIn => {
    loginStateChange(loggedIn);
  });
  // Bind to fetch commands
  fetch.setup(getClientString(), API_BASE_URL);
  fetch.onCommand(newCommand);

  for (const action of global.init()) {
    // @ts-expect-error -- TSCONVERSION
    store.dispatch(action);
  }

  return store;
}

export const reducer = combineReducers({
  entities: entities.reducer,
  global: global.reducer,
});

export interface RootState {
  entities: entities.EntitiesState;
  global: global.GlobalState;
}
