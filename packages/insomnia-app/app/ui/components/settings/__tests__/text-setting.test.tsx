import { render } from '@testing-library/react';
import React from 'react';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { globalBeforeEach } from '../../../../__jest__/before-each';
import { reduxStateForTest } from '../../../../__jest__/redux-state-for-test';
import { withReduxStore } from '../../../../__jest__/with-redux-store';
import { RootState } from '../../../redux/modules';
import { TextSetting } from '../text-setting';

const middlewares = [thunk];
const mockStore = configureMockStore<RootState>(middlewares);

describe('<TextSetting />', () => {
  const label = 'label text';
  const placeholder = 'placeholder text';
  const help = 'help text';
  let container = {};
  const textSetting = (
    <TextSetting
      disabled
      help={help}
      label={label}
      placeholder={placeholder}
      setting="deviceId"
    />
  );

  beforeEach(async () => {
    await globalBeforeEach();
    const store = mockStore(await reduxStateForTest());
    container = { wrapper: withReduxStore(store) };
  });

  it('should render label text', async () => {
    const { getByLabelText } = render(textSetting, container);
    expect(getByLabelText(label)).toBeInTheDocument();
  });

  it('should render placeholder text', async () => {
    const { getByPlaceholderText } = render(textSetting, container);
    expect(getByPlaceholderText(placeholder)).toBeInTheDocument();
  });

  it('should render help text', async () => {
    const { getByText } = render(textSetting, container);
    expect(getByText(help)).toBeInTheDocument();
  });

  it('should be disabled when passed a disabled prop', async () => {
    const { getByLabelText } = render(textSetting, container);
    const input = getByLabelText(label).closest('input');
    expect(input).toHaveAttribute('disabled');
  });
});
