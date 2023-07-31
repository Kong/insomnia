import { bindActionCreators, combineReducers, Store } from 'redux';

import { database as db } from '../../../common/database';
import configureStore from '../create';
import * as entities from './entities';
import * as global from './global';

export async function init(): Promise<Store> {
  const store = configureStore();
  // Do things that must happen before initial render
  const { addChanges, initializeWith: initEntities } = bindActionCreators({ addChanges: entities.addChanges, initializeWith: entities.initializeWith }, store.dispatch);

  // Link DB changes to entities reducer/actions
  const docs = await entities.allDocs();
  initEntities(docs);
  db.onChange(addChanges);
  // Initialize login state

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
