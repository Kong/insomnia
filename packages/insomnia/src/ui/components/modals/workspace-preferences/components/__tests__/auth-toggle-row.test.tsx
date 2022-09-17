import { beforeEach, describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { FC } from 'react';

import { globalBeforeEach } from '../../../../../../__jest__/before-each';
import { createMockStoreWithWorkspace } from '../../../../../../__jest__/create-mock-store-with-active-workspace';
import { withReduxStore } from '../../../../../../__jest__/with-redux-store';
import * as models from '../../../../../../models';
import { AuthToggleRow } from '../auth-toggle-row';

const Row: FC = ({ children }) => <div>{children}</div>;

describe('<AuthToggleRow />', () => {
  beforeEach(globalBeforeEach);

  it('should update the authentication property on changing toggle', async () => {
    // Arrange
    const { store, workspaceId } = await createMockStoreWithWorkspace();

    // Render
    const { findByRole, queryByTestId } = render(
      <AuthToggleRow label='toggleLabel' property='toggleProperty' />,
      { wrapper: withReduxStore(store, Row) }
    );

    // Assert
    let workspace = await models.workspace.getById(workspaceId);
    expect(workspace?.authentication.toggleProperty).toBeFalsy();

    expect(queryByTestId('toggle-is-on')).not.toBeInTheDocument();
    expect(queryByTestId('toggle-is-off')).toBeInTheDocument();

    // Act
    await userEvent.click(await findByRole('button'));

    // Assert
    workspace = await models.workspace.getById(workspaceId);
    expect(workspace?.authentication.toggleProperty).toBeTruthy();
  });

  it('should update the authentication property on changing toggle while inverted', async () => {
    // Arrange
    const { store, workspaceId } = await createMockStoreWithWorkspace();

    // Render
    const { findByRole, queryByTestId } = render(
      <AuthToggleRow label='toggleLabel' property='toggleProperty' invert />,
      { wrapper: withReduxStore(store, Row) }
    );

    // Assert
    let workspace = await models.workspace.getById(workspaceId);
    expect(workspace?.authentication.toggleProperty).toBeFalsy();

    expect(queryByTestId('toggle-is-on')).toBeInTheDocument();
    expect(queryByTestId('toggle-is-off')).not.toBeInTheDocument();

    // Act
    await userEvent.click(await findByRole('button'));

    // Assert
    workspace = await models.workspace.getById(workspaceId);
    expect(workspace?.authentication.toggleProperty).toBeTruthy();
  });

  it('should pre-fill the authentication property toggle', async () => {
    // Arrange
    const { store, workspaceId } = await createMockStoreWithWorkspace({ workspacePatch: { authentication: { toggleProperty: true } } });

    // Render
    const { findByRole, queryByTestId } = render(
      <AuthToggleRow label='toggleLabel' property='toggleProperty' />,
      { wrapper: withReduxStore(store, Row) }
    );

    // Assert
    let workspace = await models.workspace.getById(workspaceId);
    expect(workspace?.authentication.toggleProperty).toBe(true);

    expect(queryByTestId('toggle-is-on')).toBeInTheDocument();
    expect(queryByTestId('toggle-is-off')).not.toBeInTheDocument();

    // Act
    await userEvent.click(await findByRole('button'));

    // Assert
    workspace = await models.workspace.getById(workspaceId);
    expect(workspace?.authentication.toggleProperty).toBe(false);
  });
});
