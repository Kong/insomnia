import classnames from 'classnames';
import React, { FC, memo } from 'react';

import Tooltip from '../tooltip';

interface Props {
  milliseconds: number;
  small?: boolean;
  className?: string;
  tooltipDelay?: number;
}

export const TimeTag: FC<Props> = memo(({ milliseconds, small, className, tooltipDelay }) => {
  let unit = 'ms';
  let number = milliseconds;

  if (milliseconds > 1000 * 60) {
    unit = 'm';
    number = milliseconds / 1000 / 60;
  } else if (milliseconds > 1000) {
    unit = 's';
    number = milliseconds / 1000;
  }

  // Round to 0, 1, 2 decimal places depending on how big the number is
  if (number > 100) {
    number = Math.round(number);
  } else if (number > 10) {
    number = Math.round(number * 10) / 10;
  } else {
    number = Math.round(number * 100) / 100;
  }

  const description = `${milliseconds.toFixed(3)} milliseconds`;
  return (
    <div
      className={classnames(
        'tag',
        {
          'tag--small': small,
        },
        className,
      )}
    >
      <Tooltip message={description} position="bottom" delay={tooltipDelay}>
        {number}&nbsp;{unit}
      </Tooltip>
    </div>
  );
});

TimeTag.displayName = 'TimeTag';
