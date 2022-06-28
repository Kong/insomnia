import { describe, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import configureMockStore, { MockStoreEnhanced } from 'redux-mock-store';
import thunk from 'redux-thunk';

import { registerModal } from '../../modals';
import { LoginModal } from '../../modals/login-modal';
import { AccountDropdownButton } from './account-dropdown';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

export const createMockStore = async ({ disablePaidFeatureAds = false }: { disablePaidFeatureAds: boolean }): Promise<MockStoreEnhanced<unknown, {}>> => {
  return mockStore({ entities: { settings: { disablePaidFeatureAds } } });
};

describe('<AccountDropdownButton />', () => {
  const getDropdownContainer = () => {
    const container = document.createElement('div');
    container.setAttribute('id', 'dropdowns-container');
    document.body.appendChild(container);

    return container;
  };

  test('renders without exploding', async () => {
    const container = getDropdownContainer();
    const store = await createMockStore({ disablePaidFeatureAds: true });

    render(
      <Provider store={store}>
        <AccountDropdownButton />
      </Provider>, { container }
    );

    expect(screen.getByText('Log In')).toBeDefined();
  });

  test('renders "Log In" label without paid feature ads', async () => {
    const container = getDropdownContainer();
    const store = await createMockStore({ disablePaidFeatureAds: true });
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
    const store = await createMockStore({ disablePaidFeatureAds: false });

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
    const store = await createMockStore({ disablePaidFeatureAds: true });

    render(
      <Provider store={store}>
        <AccountDropdownButton />
        <LoginModal ref={registerModal} />
      </Provider>, { container }
    );

    const loginBtn = screen.getByText('Log In');
    expect(loginBtn).toBeDefined();

    await user.click(loginBtn);

    expect(await screen.findByTestId('LoginModal__form')).toBeDefined();
    expect(await screen.getByText('Email')).toBeDefined();
    expect(await screen.getByText('Password')).toBeDefined();
  });

  test('renders "Logout" label when session is logged in', async () => {
    global.localStorage.setItem('currentSessionId', 'sessionIdForTesting');
    const container = getDropdownContainer();
    const store = await createMockStore({ disablePaidFeatureAds: true });

    render(
      <Provider store={store}>
        <AccountDropdownButton />
      </Provider>, { container }
    );

    expect(screen.getByText('Logout')).toBeDefined();
    global.localStorage.clear();
  });
});
