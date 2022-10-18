import { beforeEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react';
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
  let renderOptions = {};
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
    renderOptions = { wrapper: withReduxStore(store) };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render label text', async () => {
    const { getByLabelText } = render(textSetting, renderOptions);
    expect(getByLabelText(label)).toBeInTheDocument();
  });

  it('should render placeholder text', async () => {
    const { getByPlaceholderText } = render(textSetting, renderOptions);
    expect(getByPlaceholderText(placeholder)).toBeInTheDocument();
  });

  it('should render help text', async () => {
    jest.useFakeTimers();
    const { container, findByRole } = render(textSetting, renderOptions);

    fireEvent.mouseMove(container);
    fireEvent.mouseEnter(container.querySelector('.tooltip'));

    act(jest.runAllTimers);

    const helpText = await findByRole(/tooltip/);
    expect(helpText).toBeInTheDocument();
  });

  it('should be disabled when passed a disabled prop', async () => {
    const { getByLabelText } = render(textSetting, renderOptions);
    const input = getByLabelText(label).closest('input');
    expect(input).toHaveAttribute('disabled');
  });
});
