import classnames from 'classnames';
import React, { FC, memo } from 'react';

import { getExecution } from '../../../network/request-timing';
import { Tooltip } from '../tooltip';

interface Props {
  milliseconds: number;
  small?: boolean;
  className?: string;
  tooltipDelay?: number;
  requestId?: string;
}
const getTimeAndUnit = (milliseconds: number) => {
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

  return { number, unit };
};
export const TimeTag: FC<Props> = memo(({ milliseconds, small, className, tooltipDelay, requestId }) => {
  const steparray = getExecution(requestId);
  const totalMs = steparray?.reduce((acc, step) => acc + (step.duration || 0), 0) || milliseconds;
  const { number, unit } = getTimeAndUnit(totalMs);

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
      <Tooltip
        message={(
          <div>
            {steparray?.map(step => {
              const { number, unit } = getTimeAndUnit(step.duration || 0);
              return (<div key={step.stepName} className='flex justify-between'>
                <div>{step.stepName}</div> <div>{number} {unit}</div>
              </div>);
            })}
            <div key="total">Total {number} {unit}</div>
          </div>)}
        position="bottom"
        delay={tooltipDelay}
      >
        {number}&nbsp;{unit}
      </Tooltip>
    </div>
  );
});

TimeTag.displayName = 'TimeTag';
