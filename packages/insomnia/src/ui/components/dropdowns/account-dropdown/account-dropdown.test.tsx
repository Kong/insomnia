import { describe, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import configureMockStore, { MockStoreEnhanced } from 'redux-mock-store';
import thunk from 'redux-thunk';

import { getDropdownContainer } from '../../../../__jest__/dropdown-container';
import * as models from '../../../../models';
import { registerModal } from '../../modals';
import { LoginModal } from '../../modals/login-modal';
import { AccountDropdownButton } from './account-dropdown';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

const createSettings = (disablePaidFeatureAds: boolean) => {
  const settings = models.settings.init();
  settings.disablePaidFeatureAds = disablePaidFeatureAds;
  return settings;
};

export const createMockStoreWithoutPaidFeatureAd = async (disablePaidFeatureAds: boolean): Promise<MockStoreEnhanced<unknown, {}>> => {
  const settings = createSettings(disablePaidFeatureAds);
  return mockStore({
    global: {},
    entities: {
      settings: [settings],
    },
  });
};

describe('<AccountDropdownButton />', () => {
  test('renders without exploding', async () => {
    const container = getDropdownContainer();
    const store = await createMockStoreWithoutPaidFeatureAd(true);
    render(
      <Provider store={store}>
        <AccountDropdownButton />
      </Provider>, { container }
    );
    expect(screen.getByText('Log In')).toBeDefined();
  });

  test('renders "Log In" label without paid feature ads', async () => {
    const container = getDropdownContainer();
    const store = await createMockStoreWithoutPaidFeatureAd(true);
    render(
      <Provider store={store}>
        <AccountDropdownButton />
      </Provider>, { container }
    );
    expect(screen.getByText('Log In')).toBeDefined();
    expect(screen.queryByText('Upgrade Now')).toBeNull();
  });

  test('renders "Log In" label with paid feature ads', async () => {
    const container = getDropdownContainer();
    const store = await createMockStoreWithoutPaidFeatureAd(false);
    render(
      <Provider store={store}>
        <AccountDropdownButton />
      </Provider>, { container }
    );
    expect(screen.getByText('Log In')).toBeDefined();
    expect(screen.getByText('Upgrade Now')).toBeDefined();
  });

  test('opens a Login modal when "Log In" button is clicked', async () => {
    const user = userEvent.setup();
    const container = getDropdownContainer();
    const store = await createMockStoreWithoutPaidFeatureAd(true);
    render(
      <Provider store={store}>
        <AccountDropdownButton />
        <LoginModal ref={registerModal} />
      </Provider>, { container }
    );
    const loginBtn = screen.getByText('Log In');
    expect(loginBtn).toBeDefined();
    await user.click(loginBtn);
    expect(await screen.findByTestId('LoginModal__url')).toBeDefined();
  });

  test('renders "Logout" label when session is logged in', async () => {
    global.localStorage.setItem('currentSessionId', 'sessionIdForTesting');
    const container = getDropdownContainer();
    const store = await createMockStoreWithoutPaidFeatureAd(true);
    render(
      <Provider store={store}>
        <AccountDropdownButton />
      </Provider>, { container }
    );
    expect(screen.getByText('Logout')).toBeDefined();
    global.localStorage.clear();
  });
});
