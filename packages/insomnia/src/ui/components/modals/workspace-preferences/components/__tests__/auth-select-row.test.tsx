import { beforeEach, describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { FC } from 'react';

import { globalBeforeEach } from '../../../../../../__jest__/before-each';
import { createMockStoreWithWorkspace } from '../../../../../../__jest__/create-mock-store-with-active-workspace';
import { withReduxStore } from '../../../../../../__jest__/with-redux-store';
import * as models from '../../../../../../models';
import { AuthSelectRow } from '../auth-select-row';

const Row: FC = ({ children }) => <div>{children}</div>;

const options = [{
  name: 'opt-1',
  value: 'val-1',
}, {
  name: 'opt-2',
  value: 'val-2',
}];

describe('<AuthSelectRow />', () => {
  beforeEach(globalBeforeEach);

  it('should update the authentication property on changing selection', async () => {
    // Arrange
    const { store, workspaceId } = await createMockStoreWithWorkspace();

    // Render
    const { findByLabelText } = render(
      <AuthSelectRow label='selectLabel' property='selectProperty' options={options} />,
      { wrapper: withReduxStore(store, Row) }
    );

    // Assert
    expect(await findByLabelText('selectLabel')).toHaveValue(options[0].value);

    // Act
    await userEvent.selectOptions(await findByLabelText('selectLabel'), options[1].name);

    // Assert
    let workspace = await models.workspace.getById(workspaceId);
    expect(workspace?.authentication.selectProperty).toEqual(options[1].value);

    // Act
    await userEvent.selectOptions(await findByLabelText('selectLabel'), options[0].name);

    // Assert
    workspace = await models.workspace.getById(workspaceId);
    expect(workspace?.authentication.selectProperty).toEqual(options[0].value);
  });

  it('should pre-select the authentication property value', async () => {
    // Arrange
    const { store } = await createMockStoreWithWorkspace({ workspacePatch: { authentication: { selectProperty: options[1].value } } });

    // Render
    const { findByLabelText } = render(
      <AuthSelectRow label='selectLabel' property='selectProperty' options={options} />,
      { wrapper: withReduxStore(store, Row) }
    );

    // Assert
    expect(await findByLabelText('selectLabel')).toHaveValue(options[1].value);
  });
});
