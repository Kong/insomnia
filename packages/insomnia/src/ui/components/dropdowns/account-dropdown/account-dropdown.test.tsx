import { describe, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import configureMockStore, { MockStoreEnhanced } from 'redux-mock-store';
import thunk from 'redux-thunk';

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

  // TODO: try to define test cases of how this component should behave
  test('renders "Log In" label without paid feature ads', async () => {
    const container = getDropdownContainer();
    const store = await createMockStore({ disablePaidFeatureAds: true });
    render(
      <Provider store={store}>
        <AccountDropdownButton />
      </Provider>, { container }
    );
    expect(screen.getByText('Log In')).toBeDefined();
    expect(screen.queryByText('Upgrde Now')).toBeNull();
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

  test.todo('renders "Log Out" label');
});
