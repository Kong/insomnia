import { beforeEach, describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react';
import React from 'react';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { globalBeforeEach } from '../../../../__jest__/before-each';
import { reduxStateForTest } from '../../../../__jest__/redux-state-for-test';
import { withReduxStore } from '../../../../__jest__/with-redux-store';
import { RootState } from '../../../redux/modules';
import { BooleanSetting } from '../boolean-setting';

const middlewares = [thunk];
const mockStore = configureMockStore<RootState>(middlewares);

describe('<BooleanSetting />', () => {
  const label = 'label text';
  const help = 'help text';
  let container = {};
  const booleanSetting = (
    <BooleanSetting
      help={help}
      label={label}
      setting="allowNotificationRequests"
    />
  );

  beforeEach(async () => {
    await globalBeforeEach();
    const store = mockStore(await reduxStateForTest());
    container = { wrapper: withReduxStore(store) };
  });

  it('should render label text', async () => {
    const { getByLabelText } = render(booleanSetting, container);
    expect(getByLabelText(label)).toBeInTheDocument();
  });
});
