import classnames from 'classnames';
import React, { FC, memo } from 'react';

import { RESPONSE_CODE_DESCRIPTIONS, RESPONSE_CODE_REASONS } from '../../../common/constants';
import { Tooltip } from '../tooltip';

interface Props {
  statusCode: number;
  small?: boolean;
  statusMessage?: string;
  tooltipDelay?: number;
}

export const StatusTag: FC<Props> = memo(({ statusMessage, statusCode, small, tooltipDelay }) => {
  let statusCodeToDisplay: string | number = statusCode;
  const firstChar = (statusCode + '')[0] || '';

  const colorClass = {
    '1': 'bg-info',
    '2': 'bg-success',
    '3': 'bg-surprise',
    '4': 'bg-warning',
    '5': 'bg-danger',
    '0': 'bg-danger',
  }[firstChar] || 'bg-surprise';

  if (firstChar === '0') {
    statusCodeToDisplay = '';
  }

  const description = RESPONSE_CODE_DESCRIPTIONS[statusCode] || 'Unknown Response Code';
  const isStatusMessageUnknown = statusMessage === 'Unknown' || statusMessage === 'unknown';
  let statusMessageToShow = statusMessage || RESPONSE_CODE_REASONS[statusCode];
  if (isStatusMessageUnknown) {
    statusMessageToShow = RESPONSE_CODE_REASONS[statusCode] || statusMessage;
  }
  return (
    <div
      className={classnames('tag', colorClass, { 'tag--small': small })}
      data-testid="response-status-tag"
    >
      <Tooltip message={description} position="bottom" delay={tooltipDelay}>
        <strong>{statusCodeToDisplay}</strong>{' '}
        {statusMessageToShow}
      </Tooltip>
    </div>
  );
});

StatusTag.displayName = 'StatusTag';
