import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { FC } from 'react';

import { globalBeforeEach } from '../../../../../../__jest__/before-each';
import { createMockStoreWithRequest } from '../../../../../../__jest__/create-mock-store-with-active-request';
import { MockCodeEditor } from '../../../../../../__jest__/mock-code-editor';
import { withReduxStore } from '../../../../../../__jest__/with-redux-store';
import * as models from '../../../../../../models';
import { AuthInputRow } from '../auth-input-row';

jest.mock('../../../../codemirror/code-editor', () => ({
  CodeEditor: MockCodeEditor,
}));

const Table: FC = ({ children }) => <table><tbody>{children}</tbody></table>;

describe('<AuthInputRow />', () => {
  beforeEach(globalBeforeEach);

  it('should mask and toggle the input', async () => {
    // Arrange
    await models.settings.patch({  showPasswords: false });
    const { store } = await createMockStoreWithRequest();

    // Render with mask enabled
    const { findByLabelText, findByTestId } = render(
      <AuthInputRow label='inputLabel' property='inputProperty' mask />,
      { wrapper: withReduxStore(store, Table) }
    );

    let input = await findByLabelText('inputLabel');
    expect(input).toHaveAttribute('type', 'password');

    // Act
    await userEvent.click(await findByTestId('reveal-password-icon'));

    // Assert
    input = await findByLabelText('inputLabel');
    expect(input).toHaveAttribute('type', 'text');

    // Act
    await userEvent.click(await findByTestId('mask-password-icon'));

    // Assert
    input = await findByLabelText('inputLabel');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('should not show masking toggle if all passwords are shown', async () => {
    // Arrange
    await models.settings.patch({ showPasswords: true });
    const { store } = await createMockStoreWithRequest();

    // Render with mask enabled
    const { findByLabelText, queryAllByTestId } = render(
      <AuthInputRow label='inputLabel' property='inputProperty' mask />,
      { wrapper: withReduxStore(store, Table) }
    );

    // Assert
    const input = await findByLabelText('inputLabel');
    expect(input).toHaveAttribute('type', 'text');
    expect(queryAllByTestId('reveal-password-icon')).toHaveLength(0);
    expect(queryAllByTestId('mask-password-icon')).toHaveLength(0);
  });

  it('should update the authentication property on typing', async () => {
    // Arrange
    const { store, requestId } = await createMockStoreWithRequest();

    const { findByLabelText } = render(
      <AuthInputRow label='inputLabel' property='inputProperty' />,
      { wrapper: withReduxStore(store, Table) }
    );

    // This is a function because the underlying component changes as the element gets focus
    const getInput = () => findByLabelText('inputLabel');

    // Act
    expect(await getInput()).not.toHaveFocus();
    await userEvent.click(await getInput());
    expect(await getInput()).toHaveFocus();

    // NOTE: we are typing into a mocked CodeEditor component.
    await userEvent.type(await getInput(), 'inputValue');

    // Assert
    const request = await models.request.getById(requestId);
    expect(request?.authentication.inputProperty).toEqual('inputValue');
  });

  it('should pre-fill existing authentication property value', async () => {
    // Arrange
    const { store } = await createMockStoreWithRequest({ requestPatch: { authentication: { inputProperty: 'existing' } } });

    const { findByLabelText } = render(
      <AuthInputRow label='inputLabel' property='inputProperty' />,
      { wrapper: withReduxStore(store, Table) }
    );

    // Assert
    expect(await findByLabelText('inputLabel')).toHaveValue('existing');
  });
});
