import configureMockStore from 'redux-mock-store';
import { MockStoreEnhanced } from 'redux-mock-store';
import thunk from 'redux-thunk';

import * as models from '../../models';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

const createSettings = () => {
  const settings = models.settings.init();
  return settings;
};

export const createMockStore = async (): Promise<MockStoreEnhanced<unknown, {}>> => {
  const settings = createSettings();
  return mockStore({
    global: {
      isLoggedIn: false,
    },
    entities: {
      settings: [settings],
    },
  });
};
