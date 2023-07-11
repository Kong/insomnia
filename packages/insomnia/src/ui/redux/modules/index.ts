import { bindActionCreators, combineReducers, Store } from 'redux';

import { isLoggedIn, onLoginLogout } from '../../../account/session';
import { database as db } from '../../../common/database';
import configureStore from '../create';
import * as entities from './entities';
import * as global from './global';

export async function init(): Promise<Store> {
  const store = configureStore();
  // Do things that must happen before initial render
  const { addChanges, initializeWith: initEntities } = bindActionCreators({ addChanges: entities.addChanges, initializeWith: entities.initializeWith }, store.dispatch);

  // @ts-expect-error -- TSCONVERSION
  const { loginStateChange } = bindActionCreators(global, store.dispatch);
  // Link DB changes to entities reducer/actions
  const docs = await entities.allDocs();
  initEntities(docs);
  db.onChange(addChanges);
  // Initialize login state
  loginStateChange(isLoggedIn());
  onLoginLogout(loggedIn => {
    loginStateChange(loggedIn);
  });

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
