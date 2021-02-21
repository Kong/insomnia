import { bindActionCreators, combineReducers } from 'redux';
import * as entities from './entities';
import configureStore from '../create';
import * as global from './global';
import * as db from '../../../common/database';
import {
  ACTIVITY_MIGRATION,
  ACTIVITY_ONBOARDING,
  API_BASE_URL,
  getClientString,
} from '../../../common/constants';
import { isLoggedIn, onLoginLogout } from '../../../account/session';
import * as fetch from '../../../account/fetch';
import fs from 'fs';
import { getDesignerDataDir } from '../../../common/misc';

export async function init(settings) {
  const store = configureStore();

  // Do things that must happen before initial render
  const { addChanges, initializeWith: initEntities } = bindActionCreators(entities, store.dispatch);
  const { newCommand, loginStateChange, setActiveActivity, goToNextActivity } = bindActionCreators(
    global,
    store.dispatch,
  );

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
    store.dispatch(action);
  }

  // if (!isDevelopment) {
  // Check if we should load from Designer
  if (!settings.hasPromptedToMigrateFromDesigner && fs.existsSync(getDesignerDataDir())) {
    // await models.settings.update(settings, { hasPromptedToMigrateFromDesigner: true });
    setActiveActivity(ACTIVITY_MIGRATION);
  } else if (!settings.hasPromptedOnboarding) {
    // await models.settings.update(settings, { hasPromptedOnboarding: true });
    setActiveActivity(ACTIVITY_ONBOARDING);
  } else {
    goToNextActivity();
  }
  // }

  return store;
}

export const reducer = combineReducers({
  entities: entities.reducer,
  global: global.reducer,
});
