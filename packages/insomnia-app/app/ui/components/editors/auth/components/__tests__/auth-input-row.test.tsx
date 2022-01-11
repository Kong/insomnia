import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { globalBeforeEach } from '../../../../../../__jest__/before-each';
import { MockCodeEditor } from '../../../../../../__jest__/mock-code-editor';
import { reduxStateForTest } from '../../../../../../__jest__/redux-state-for-test';
import { withReduxStore } from '../../../../../../__jest__/with-redux-store';
import { ACTIVITY_DEBUG } from '../../../../../../common/constants';
import * as models from '../../../../../../models';
import { RootState } from '../../../../../redux/modules';
import { AuthInputRow } from '../auth-input-row';
import { AuthTableBody } from '../auth-table-body';

const middlewares = [thunk];
const mockStore = configureMockStore<RootState>(middlewares);

jest.mock('../../../../codemirror/code-editor', () => ({
  CodeEditor: MockCodeEditor,
}));

describe('<AuthInputRow />', () => {
  beforeEach(globalBeforeEach);

  it('should mask and toggle the input', async () => {
    // Arrange
    await models.settings.patch({  showPasswords: false });
    const { _id: projectId } = await models.project.create();
    const { _id: workspaceId } = await models.workspace.create({ parentId: projectId });
    const { _id: requestId } = await models.request.create({ parentId: workspaceId });
    await models.workspaceMeta.create({ parentId: workspaceId, activeRequestId: requestId });

    const store = mockStore(await reduxStateForTest({ activeProjectId: projectId, activeWorkspaceId: workspaceId, activeActivity: ACTIVITY_DEBUG }));

    // Render with mask enabled
    const { findByLabelText, findByTestId } = render(
      <AuthInputRow label='inputLabel' property='inputProperty' mask />,
      { wrapper: withReduxStore(store, AuthTableBody) }
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
    const { _id: projectId } = await models.project.create();
    const { _id: workspaceId } = await models.workspace.create({ parentId: projectId });
    const { _id: requestId } = await models.request.create({ parentId: workspaceId });
    await models.workspaceMeta.create({ parentId: workspaceId, activeRequestId: requestId });

    const store = mockStore(await reduxStateForTest({ activeProjectId: projectId, activeWorkspaceId: workspaceId, activeActivity: ACTIVITY_DEBUG }));

    // Render with mask enabled
    const { findByLabelText, queryAllByTestId } = render(
      <AuthInputRow label='inputLabel' property='inputProperty' mask />,
      { wrapper: withReduxStore(store, AuthTableBody) }
    );

    // Assert
    const input = await findByLabelText('inputLabel');
    expect(input).toHaveAttribute('type', 'text');
    expect(queryAllByTestId('reveal-password-icon')).toHaveLength(0);
    expect(queryAllByTestId('mask-password-icon')).toHaveLength(0);
  });

  it('should update the authentication property on typing', async () => {
    // Arrange
    const { _id: projectId } = await models.project.create();
    const { _id: workspaceId } = await models.workspace.create({ parentId: projectId });
    const { _id: requestId } = await models.request.create({ parentId: workspaceId });
    await models.workspaceMeta.create({ parentId: workspaceId, activeRequestId: requestId });

    const store = mockStore(await reduxStateForTest({ activeProjectId: projectId, activeWorkspaceId: workspaceId, activeActivity: ACTIVITY_DEBUG }));

    const { findByLabelText } = render(
      <AuthInputRow label='inputLabel' property='inputProperty' />,
      { wrapper: withReduxStore(store, AuthTableBody) }
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
    const { _id: projectId } = await models.project.create();
    const { _id: workspaceId } = await models.workspace.create({ parentId: projectId });
    const { _id: requestId } = await models.request.create({ parentId: workspaceId, authentication: { inputProperty: 'existing' } });
    await models.workspaceMeta.create({ parentId: workspaceId, activeRequestId: requestId });

    const store = mockStore(await reduxStateForTest({ activeProjectId: projectId, activeWorkspaceId: workspaceId, activeActivity: ACTIVITY_DEBUG }));

    const { findByLabelText } = render(
      <AuthInputRow label='inputLabel' property='inputProperty' />,
      { wrapper: withReduxStore(store, AuthTableBody) }
    );

    // Assert
    expect(await findByLabelText('inputLabel')).toHaveValue('existing');
  });
});
