import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { globalBeforeEach } from '../../../../../../__jest__/before-each';
import { reduxStateForTest } from '../../../../../../__jest__/redux-state-for-test';
import { withReduxStore } from '../../../../../../__jest__/with-redux-store';
import { ACTIVITY_DEBUG } from '../../../../../../common/constants';
import * as models from '../../../../../../models';
import { RootState } from '../../../../../redux/modules';
import { AuthSelectRow } from '../auth-select-row';
import { AuthTableBody } from '../auth-table-body';

const middlewares = [thunk];
const mockStore = configureMockStore<RootState>(middlewares);

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
    const { _id: projectId } = await models.project.create();
    const { _id: workspaceId } = await models.workspace.create({ parentId: projectId });
    const { _id: requestId } = await models.request.create({ parentId: workspaceId });
    await models.workspaceMeta.create({ parentId: workspaceId, activeRequestId: requestId });

    const store = mockStore(await reduxStateForTest({ activeProjectId: projectId, activeWorkspaceId: workspaceId, activeActivity: ACTIVITY_DEBUG }));

    // Render
    const { findByLabelText } = render(
      <AuthSelectRow label='selectLabel' property='selectProperty' options={options} />,
      { wrapper: withReduxStore(store, AuthTableBody) }
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
    const { _id: projectId } = await models.project.create();
    const { _id: workspaceId } = await models.workspace.create({ parentId: projectId });
    const { _id: requestId } = await models.request.create({ parentId: workspaceId, authentication: { selectProperty: options[1].value } });
    await models.workspaceMeta.create({ parentId: workspaceId, activeRequestId: requestId });

    const store = mockStore(await reduxStateForTest({ activeProjectId: projectId, activeWorkspaceId: workspaceId, activeActivity: ACTIVITY_DEBUG }));

    // Render
    const { findByLabelText } = render(
      <AuthSelectRow label='selectLabel' property='selectProperty' options={options} />,
      { wrapper: withReduxStore(store, AuthTableBody) }
    );

    // Assert
    expect(await findByLabelText('selectLabel')).toHaveValue(options[1].value);
  });
});
