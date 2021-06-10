import { bindActionCreators, combineReducers } from 'redux';
import * as entities from './entities';
import configureStore from '../create';
import { reducer as globalReducer, newCommand, loginStateChange, initActions } from './global';
import { database as db } from '../../../common/database';
import { API_BASE_URL, getClientString } from '../../../common/constants';
import { isLoggedIn, onLoginLogout } from '../../../account/session';
import { setup, onCommand } from '../../../account/fetch';

// TODO there's a circular dependency between this file and /redux/create
export async function init() {
  const store = configureStore();

  // Do things that must happen before initial render
  const bound = bindActionCreators({
    addChanges: entities.addChanges,
    initializeWith: entities.initializeWith,
    newCommand,
    loginStateChange,
  }, store.dispatch);

  // Link DB changes to entities reducer/actions
  const docs = await entities.allDocs();
  bound.initializeWith(docs);
  db.onChange(bound.addChanges);

  // Initialize login state
  bound.loginStateChange(isLoggedIn());
  onLoginLogout(loggedIn => {
    bound.loginStateChange(loggedIn);
  });

  // Bind to fetch commands
  setup(getClientString(), API_BASE_URL);
  onCommand(bound.newCommand);

  initActions.forEach(action => {
    // @ts-expect-error -- TSCONVERSION need to merge in Redux-Thunk types to root
    store.dispatch(action);
  });

  return store;
}

export const reducer = combineReducers({
  entities: entities.reducer,
  global: globalReducer,
});
