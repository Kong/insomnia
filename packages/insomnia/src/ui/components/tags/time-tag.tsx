import classnames from 'classnames';
import React, { type FC, memo } from 'react';

import type { TimingStep } from '../../../main/network/request-timing';
import { Tooltip } from '../tooltip';

interface Props {
  milliseconds: number;
  small?: boolean;
  className?: string;
  tooltipDelay?: number;
  steps?: TimingStep[];
}
export const getTimeAndUnit = (milliseconds: number) => {
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
export const TimeTag: FC<Props> = memo(({ milliseconds, small, className, tooltipDelay, steps }) => {
  const totalMs = steps?.reduce((acc, step) => acc + (step.duration || 0), 0) || milliseconds;
  const { number, unit } = getTimeAndUnit(totalMs);
  const timesandunits = steps?.map(step => {
    const { number, unit } = getTimeAndUnit(step.duration || 0);
    return { stepName: step.stepName, number, unit };
  });
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
            {timesandunits?.map(step =>
            (<div key={step.stepName} className='flex justify-between'>
              <div className='mr-5'>{step.stepName} </div><div>{step.number} {step.unit}</div>
            </div>)
            )}
            <div key="total" className='flex justify-between'>
              <div className='mr-5'>Total </div><div>{number} {unit}</div>
            </div>
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
