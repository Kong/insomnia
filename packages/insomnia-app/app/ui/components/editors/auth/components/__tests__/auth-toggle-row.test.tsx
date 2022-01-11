import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { FC } from 'react';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { globalBeforeEach } from '../../../../../../__jest__/before-each';
import { reduxStateForTest } from '../../../../../../__jest__/redux-state-for-test';
import { withReduxStore } from '../../../../../../__jest__/with-redux-store';
import { ACTIVITY_DEBUG } from '../../../../../../common/constants';
import * as models from '../../../../../../models';
import { RootState } from '../../../../../redux/modules';
import { AuthToggleRow } from '../auth-toggle-row';

const middlewares = [thunk];
const mockStore = configureMockStore<RootState>(middlewares);

const Table: FC = ({ children }) => <table><tbody>{children}</tbody></table>;

describe('<AuthToggleRow />', () => {
  beforeEach(globalBeforeEach);

  it('should update the authentication property on changing toggle', async () => {
    // Arrange
    const { _id: projectId } = await models.project.create();
    const { _id: workspaceId } = await models.workspace.create({ parentId: projectId });
    const { _id: requestId } = await models.request.create({ parentId: workspaceId });
    await models.workspaceMeta.create({ parentId: workspaceId, activeRequestId: requestId, activeActivity: ACTIVITY_DEBUG });

    const store = mockStore(await reduxStateForTest({ activeProjectId: projectId, activeWorkspaceId: workspaceId, activeActivity: ACTIVITY_DEBUG }));

    // Render
    const { findByRole, queryByTestId } = render(
      <AuthToggleRow label='toggleLabel' property='toggleProperty' />,
      { wrapper: withReduxStore(store, Table) }
    );

    // Assert
    let request = await models.request.getById(requestId);
    expect(request?.authentication.toggleProperty).toBeFalsy();

    expect(queryByTestId('toggle-is-on')).not.toBeInTheDocument();
    expect(queryByTestId('toggle-is-off')).toBeInTheDocument();

    // Act
    await userEvent.click(await findByRole('button'));

    // Assert
    request = await models.request.getById(requestId);
    expect(request?.authentication.toggleProperty).toBeTruthy();
  });

  it('should update the authentication property on changing toggle while inverted', async () => {
    // Arrange
    const { _id: projectId } = await models.project.create();
    const { _id: workspaceId } = await models.workspace.create({ parentId: projectId });
    const { _id: requestId } = await models.request.create({ parentId: workspaceId });
    await models.workspaceMeta.create({ parentId: workspaceId, activeRequestId: requestId, activeActivity: ACTIVITY_DEBUG });

    const store = mockStore(await reduxStateForTest({ activeProjectId: projectId, activeWorkspaceId: workspaceId, activeActivity: ACTIVITY_DEBUG }));

    // Render
    const { findByRole, queryByTestId } = render(
      <AuthToggleRow label='toggleLabel' property='toggleProperty' invert />,
      { wrapper: withReduxStore(store, Table) }
    );

    // Assert
    let request = await models.request.getById(requestId);
    expect(request?.authentication.toggleProperty).toBeFalsy();

    expect(queryByTestId('toggle-is-on')).toBeInTheDocument();
    expect(queryByTestId('toggle-is-off')).not.toBeInTheDocument();

    // Act
    await userEvent.click(await findByRole('button'));

    // Assert
    request = await models.request.getById(requestId);
    expect(request?.authentication.toggleProperty).toBeTruthy();
  });

  it('should pre-fill the authentication property toggle', async () => {
    // Arrange
    const { _id: projectId } = await models.project.create();
    const { _id: workspaceId } = await models.workspace.create({ parentId: projectId });
    const { _id: requestId } = await models.request.create({ parentId: workspaceId, authentication: { toggleProperty: true } });
    await models.workspaceMeta.create({ parentId: workspaceId, activeRequestId: requestId, activeActivity: ACTIVITY_DEBUG });

    const store = mockStore(await reduxStateForTest({ activeProjectId: projectId, activeWorkspaceId: workspaceId, activeActivity: ACTIVITY_DEBUG }));

    // Render
    const { findByRole, queryByTestId } = render(
      <AuthToggleRow label='toggleLabel' property='toggleProperty' />,
      { wrapper: withReduxStore(store, Table) }
    );

    // Assert
    let request = await models.request.getById(requestId);
    expect(request?.authentication.toggleProperty).toBe(true);

    expect(queryByTestId('toggle-is-on')).toBeInTheDocument();
    expect(queryByTestId('toggle-is-off')).not.toBeInTheDocument();

    // Act
    await userEvent.click(await findByRole('button'));

    // Assert
    request = await models.request.getById(requestId);
    expect(request?.authentication.toggleProperty).toBe(false);
  });
});
