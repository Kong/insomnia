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

  test('renders test case 1', async () => {
    const container = getDropdownContainer();
    const store = await createMockStore({ disablePaidFeatureAds: true });

    render(
      <Provider store={store}>
        <AccountDropdownButton />
      </Provider>, { container }
    );

    expect(screen.getByText('Log In')).toBeDefined();
  });

  test('renders test case 2', async () => {
    const container = getDropdownContainer();
    const store = await createMockStore({ disablePaidFeatureAds: true });

    render(
      <Provider store={store}>
        <AccountDropdownButton />
      </Provider>, { container }
    );

    expect(screen.getByText('Log In')).toBeDefined();
  });

  test('renders test case 3', async () => {
    const container = getDropdownContainer();
    const store = await createMockStore({ disablePaidFeatureAds: true });

    render(
      <Provider store={store}>
        <AccountDropdownButton />
      </Provider>, { container }
    );

    expect(screen.getByText('Log In')).toBeDefined();
  });
});
