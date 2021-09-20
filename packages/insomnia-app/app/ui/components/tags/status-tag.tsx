import classnames from 'classnames';
import React, { FC, memo } from 'react';

import { RESPONSE_CODE_DESCRIPTIONS, RESPONSE_CODE_REASONS } from '../../../common/constants';
import Tooltip from '../tooltip';

interface Props {
  statusCode: number;
  small?: boolean;
  statusMessage?: string;
  tooltipDelay?: number;
}

export const StatusTag: FC<Props> = memo(({ statusMessage, statusCode, small, tooltipDelay }) => {
  let colorClass;
  let statusCodeToDisplay: string | number = statusCode;
  const firstChar = (statusCode + '')[0] || '';

  switch (firstChar) {
    case '1':
      colorClass = 'bg-info';
      break;

    case '2':
      colorClass = 'bg-success';
      break;

    case '3':
      colorClass = 'bg-surprise';
      break;

    case '4':
      colorClass = 'bg-warning';
      break;

    case '5':
      colorClass = 'bg-danger';
      break;

    case '0':
      colorClass = 'bg-danger';
      statusCodeToDisplay = '';
      break;

    default:
      colorClass = 'bg-surprise';
      statusCodeToDisplay = '';
      break;
  }

  const description = RESPONSE_CODE_DESCRIPTIONS[statusCode] || 'Unknown Response Code';
  return (
    <div
      className={classnames('tag', colorClass, {
        'tag--small': small,
      })}
    >
      <Tooltip message={description} position="bottom" delay={tooltipDelay}>
        <strong>{statusCodeToDisplay}</strong>{' '}
        {statusMessage || RESPONSE_CODE_REASONS[statusCode]}
      </Tooltip>
    </div>
  );
});

StatusTag.displayName = 'StatusTag';
