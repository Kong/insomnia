import { act, fireEvent, render } from '@testing-library/react';
import React from 'react';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { beforeEach, describe, expect, it } from 'vitest';

import { globalBeforeEach } from '../../../../__jest__/before-each';
import { reduxStateForTest } from '../../../../__jest__/redux-state-for-test';
import { withReduxStore } from '../../../../__jest__/with-redux-store';
import { UpdateChannel } from '../../../../common/settings';
import { RootState } from '../../../redux/modules';
import { EnumSetting } from '../enum-setting';

const middlewares = [thunk];
const mockStore = configureMockStore<RootState>(middlewares);

describe('<EnumSetting />', () => {
  const help = 'help text';
  const label = 'label text';
  const values = [
    { value: UpdateChannel.stable, name: 'Release (Recommended)' },
    { value: UpdateChannel.beta, name: 'Early Access (Beta)' },
  ];
  let renderOptions = {};
  const enumSetting = (
    <EnumSetting<UpdateChannel>
      help={help}
      label={label}
      setting="updateChannel"
      values={values}
    />
  );

  beforeEach(async () => {
    await globalBeforeEach();
    const store = mockStore(await reduxStateForTest());
    renderOptions = { wrapper: withReduxStore(store) };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render label text', async () => {
    const { getByLabelText } = render(enumSetting, renderOptions);
    expect(getByLabelText(label)).toBeInTheDocument();
  });

  it('should render help text', async () => {
    vi.useFakeTimers();
    const { container, findByRole } = render(enumSetting, renderOptions);

    fireEvent.mouseMove(container);
    fireEvent.mouseEnter(container.querySelector('.tooltip'));

    act(vi.runAllTimers);

    const helpText = await findByRole(/tooltip/);
    expect(helpText).toBeInTheDocument();
  });

  it('should be render the options provided', async () => {
    const { getByText } = render(enumSetting, renderOptions);

    expect(getByText(values[0].name)).toBeInTheDocument();
    expect(getByText(values[1].name)).toBeInTheDocument();
  });
});
