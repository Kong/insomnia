import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import Tooltip from '../tooltip';

const pause = time => new Promise(resolve => setTimeout(resolve, time));

const expectNoTooltip = queryByRole => {
  expect(queryByRole('tooltip', { hidden: true })).toBeNull();
  expect(queryByRole('tooltip')).toBeNull();
};

describe('<Tooltip />', () => {
  it('should show and hide the tooltip correctly', async () => {
    const childText = 'some child';
    const delay = 200;
    const message = 'message';

    const { getByRole, getByText, queryByRole, unmount } = render(
      <Tooltip message={message} delay={delay}>
        {childText}
      </Tooltip>,
    );

    expect(getByRole('tooltip', { hidden: true })).toBeTruthy();

    fireEvent.mouseEnter(getByText(childText));
    await pause(delay * 2);

    expect(getByRole('tooltip')).toBeTruthy();

    fireEvent.mouseLeave(getByText(childText));
    await pause(delay * 2);

    expect(getByRole('tooltip', { hidden: true })).toBeTruthy();

    unmount();

    expectNoTooltip(queryByRole);
  });

  it('should not render tooltip if no message exists', () => {
    const childText = 'some child';
    const message = '';

    const { queryByRole } = render(<Tooltip message={message}>{childText}</Tooltip>);

    expectNoTooltip(queryByRole);
  });

  it('should add tooltip is message is empty first then updates', async () => {
    const childText = 'some child';
    const initialMessage = '';
    const newMessage = 'message';

    const { queryByRole, getByRole, rerender, unmount } = render(
      <Tooltip message={initialMessage}>{childText}</Tooltip>,
    );

    expectNoTooltip(queryByRole);

    rerender(<Tooltip message={newMessage}>{childText}</Tooltip>);

    expect(getByRole('tooltip', { hidden: true })).toBeTruthy();

    unmount();

    expectNoTooltip(queryByRole);
  });
});
