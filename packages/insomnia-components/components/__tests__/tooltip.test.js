import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import Tooltip from '../tooltip';

const pause = time => new Promise(resolve => setTimeout(resolve, time));

describe('<Tooltip />', () => {
  it('should show and hide the tooltip correctly', async () => {
    const childText = 'some child';
    const delay = 200;
    const message = 'message';

    const { getByRole, getByText, queryAllByRole, unmount } = render(
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

    expect(queryAllByRole('tooltip', { hidden: true })).toHaveLength(0);
    expect(queryAllByRole('tooltip')).toHaveLength(0);
  });

  it('should not render tooltip is no message exists', () => {
    const childText = 'some child';
    const message = '';

    const { queryAllByRole } = render(<Tooltip message={message}>{childText}</Tooltip>);

    expect(queryAllByRole('tooltip', { hidden: true })).toHaveLength(0);
    expect(queryAllByRole('tooltip')).toHaveLength(0);
  });

  it('should add tooltip is message is empty first then updates', async () => {
    const childText = 'some child';
    const initialMessage = '';
    const newMessage = 'message';

    const { queryAllByRole, getByRole, rerender, unmount } = render(
      <Tooltip message={initialMessage}>{childText}</Tooltip>,
    );

    expect(queryAllByRole('tooltip', { hidden: true })).toHaveLength(0);
    expect(queryAllByRole('tooltip')).toHaveLength(0);

    rerender(<Tooltip message={newMessage}>{childText}</Tooltip>);

    expect(getByRole('tooltip', { hidden: true })).toBeTruthy();

    unmount();

    expect(queryAllByRole('tooltip', { hidden: true })).toHaveLength(0);
    expect(queryAllByRole('tooltip')).toHaveLength(0);
  });
});
