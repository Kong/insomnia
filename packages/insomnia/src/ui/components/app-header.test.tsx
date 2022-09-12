import { describe, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import { MockStoreEnhanced } from 'redux-mock-store';
import thunk from 'redux-thunk';

import { globalBeforeEach } from '../../__jest__/before-each';
import { getDropdownContainer } from '../../__jest__/dropdown-container';
import * as models from '../../models';
import { AppHeader } from './app-header';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

const createSettings = () => {
  const settings = models.settings.init();
  settings.incognitoMode = true;
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

describe('<AppHeader />', () => {
  beforeEach(globalBeforeEach);

  test('shows the github stars button when not logged in', async () => {
    const store = await createMockStore();
    const container = getDropdownContainer();

    render(
      <Provider store={store}>
        <AppHeader
          breadcrumbProps={{
            crumbs: [],
          }}
        />
      </Provider>, { container },
    );

    expect(screen.getByText('Star')).toBeDefined();
  });

  test('hides the github stars button when logged in', async () => {
    const store = await createMockStore();
    const container = getDropdownContainer();

    render(
      <Provider store={store}>
        <AppHeader
          breadcrumbProps={{
            crumbs: [],
          }}
        />
      </Provider>, { container },
    );

    expect(screen.getByText('Star')).toBeDefined();
  });
});
