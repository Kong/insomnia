import { beforeEach, describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { FC } from 'react';
import { useSelector } from 'react-redux';

import { globalBeforeEach } from '../../../../../../__jest__/before-each';
import { createMockStoreWithRequest } from '../../../../../../__jest__/create-mock-store-with-active-request';
import { withReduxStore } from '../../../../../../__jest__/with-redux-store';
import * as models from '../../../../../../models';
import { Request, RequestAuthentication } from '../../../../../../models/request';
import { selectActiveRequest } from '../../../../../redux/selectors';
import { AuthSettingsProvider } from '../auth-context';
import { AuthToggleRow } from '../auth-toggle-row';

const Wrapper: FC = ({ children }) => {
  const activeRequest = useSelector(selectActiveRequest) as Request;

  // This is inevitable as we are testing this in the unit test. Ideally we should mock it and just confirm if it was called. This is becoming an integration test, and it shouldn't be.
  const handleAuthUpdate = (authentication: RequestAuthentication) => {
    models.request.update(activeRequest, { authentication });
  };

  return (
    <AuthSettingsProvider
      authentication={activeRequest.authentication}
      onAuthUpdate={handleAuthUpdate}
    >
      <table>
        <tbody>{children}</tbody>
      </table>
    </AuthSettingsProvider>
  );
};

describe('<AuthToggleRow />', () => {
  beforeEach(globalBeforeEach);

  it('should update the authentication property on changing toggle', async () => {
    // Arrange
    const { store, requestId } = await createMockStoreWithRequest();

    // Render
    const { findByRole, queryByTestId } = render(
      <AuthToggleRow label='toggleLabel' property='toggleProperty' />,
      { wrapper: withReduxStore(store, Wrapper) }
    );

    // Assert
    let request = await models.request.getById(requestId);
    expect(request?.authentication.toggleProperty).toBeFalsy();

    expect(queryByTestId('toggle-is-on')).toBeNull();
    expect(queryByTestId('toggle-is-off')).toBeDefined();

    // Act
    await userEvent.click(await findByRole('button'));

    // Assert
    request = await models.request.getById(requestId);
    expect(request?.authentication.toggleProperty).toBeTruthy();
  });

  it('should update the authentication property on changing toggle while inverted', async () => {
    // Arrange
    const { store, requestId } = await createMockStoreWithRequest();

    // Render
    const { findByRole, queryByTestId } = render(
      <AuthToggleRow label='toggleLabel' property='toggleProperty' invert />,
      { wrapper: withReduxStore(store, Wrapper) }
    );

    // Assert
    let request = await models.request.getById(requestId);
    expect(request?.authentication.toggleProperty).toBeFalsy();

    expect(queryByTestId('toggle-is-on')).toBeDefined();
    expect(queryByTestId('toggle-is-off')).toBeNull();

    // Act
    await userEvent.click(await findByRole('button'));

    // Assert
    request = await models.request.getById(requestId);
    expect(request?.authentication.toggleProperty).toBeTruthy();
  });

  it('should pre-fill the authentication property toggle', async () => {
    // Arrange
    const { store, requestId } = await createMockStoreWithRequest({ requestPatch: { authentication: { toggleProperty: true } } });

    // Render
    const { findByRole, queryByTestId } = render(
      <AuthToggleRow label='toggleLabel' property='toggleProperty' />,
      { wrapper: withReduxStore(store, Wrapper) }
    );

    // Assert
    let request = await models.request.getById(requestId);
    expect(request?.authentication.toggleProperty).toBe(true);

    expect(queryByTestId('toggle-is-on')).toBeDefined();
    expect(queryByTestId('toggle-is-off')).toBeNull();

    // Act
    await userEvent.click(await findByRole('button'));

    // Assert
    request = await models.request.getById(requestId);
    expect(request?.authentication.toggleProperty).toBe(false);
  });
});
