import { beforeEach, describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { FC } from 'react';

import { globalBeforeEach } from '../../../../../../__jest__/before-each';
import { createMockStoreWithRequest } from '../../../../../../__jest__/create-mock-store-with-active-request';
import { withReduxStore } from '../../../../../../__jest__/with-redux-store';
import * as models from '../../../../../../models';
import { MockedAuthSettingsProvider } from '../../__tests__/mocked-auth-settings-provider';
import { AuthSelectRow } from '../auth-select-row';

const options = [{
  name: 'opt-1',
  value: 'val-1',
}, {
  name: 'opt-2',
  value: 'val-2',
}];

const Wrapper: FC = ({ children }) => {
  return (
    <MockedAuthSettingsProvider>
      <table>
        <tbody>{children}</tbody>
      </table>
    </MockedAuthSettingsProvider>
  );
};

describe('<AuthSelectRow />', () => {
  beforeEach(globalBeforeEach);

  it('should update the authentication property on changing selection', async () => {
    // Arrange
    const { store, requestId } = await createMockStoreWithRequest();

    // Render
    const { findByLabelText } = render(
      <AuthSelectRow label='selectLabel' property='selectProperty' options={options} />,
      { wrapper: withReduxStore(store, Wrapper) }
    );

    // Assert
    expect(await findByLabelText('selectLabel')).toHaveValue(options[0].value);

    // Act
    await userEvent.selectOptions(await findByLabelText('selectLabel'), options[1].name);

    // Assert
    let request = await models.request.getById(requestId);
    expect(request?.authentication.selectProperty).toEqual(options[1].value);

    // Act
    await userEvent.selectOptions(await findByLabelText('selectLabel'), options[0].name);

    // Assert
    request = await models.request.getById(requestId);
    expect(request?.authentication.selectProperty).toEqual(options[0].value);
  });

  it('should pre-select the authentication property value', async () => {
    // Arrange
    const { store } = await createMockStoreWithRequest({ requestPatch: { authentication: { selectProperty: options[1].value } } });

    // Render
    const { findByLabelText } = render(
      <AuthSelectRow label='selectLabel' property='selectProperty' options={options} />,
      { wrapper: withReduxStore(store, Wrapper) }
    );

    // Assert
    expect(await findByLabelText('selectLabel')).toHaveValue(options[1].value);
  });
});
