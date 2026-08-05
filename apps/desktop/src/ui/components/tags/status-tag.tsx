import classnames from 'classnames';
import React, { type FC, memo, type ReactNode } from 'react';

import { RESPONSE_CODE_DESCRIPTIONS, RESPONSE_CODE_REASONS } from '../../../common/constants';
import { Tooltip } from '../tooltip';

interface Props {
  statusCode: number;
  small?: boolean;
  statusMessage?: string;
  tooltipDelay?: number;
}

export const StringStatusTag = memo(
  ({
    status,
    small,
    title = '',
    statusMessage,
    description = 'Unknown Status',
    tooltipDelay,
  }: {
    status: string;
    small?: boolean;
    title?: ReactNode;
    statusMessage?: ReactNode;
    description?: ReactNode;
    tooltipDelay?: number;
  }) => {
    const colorClass =
      {
        info: 'bg-info',
        success: 'bg-success',
        surprise: 'bg-surprise',
        warning: 'bg-warning',
        danger: 'bg-danger',
      }[status] || 'bg-surprise';

    return (
      <div className={classnames('tag', colorClass, { 'tag--small': small })} data-testid="response-status-tag">
        <Tooltip message={description} position="bottom" delay={tooltipDelay}>
          <strong>{title}</strong> {statusMessage}
        </Tooltip>
      </div>
    );
  },
);

StringStatusTag.displayName = 'StringStatusTag';

export const StatusTag: FC<Props> = memo(({ statusMessage, statusCode, small, tooltipDelay }) => {
  let statusCodeToDisplay: string | number = statusCode;
  const firstChar = (statusCode + '')[0] || '';

  const status =
    {
      '1': 'info',
      '2': 'success',
      '3': 'surprise',
      '4': 'warning',
      '5': 'danger',
      '0': 'danger',
    }[firstChar] || 'surprise';

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
    <StringStatusTag
      status={status}
      small={small}
      statusMessage={statusMessageToShow}
      tooltipDelay={tooltipDelay}
      title={statusCodeToDisplay}
      description={description}
    />
  );
});

StatusTag.displayName = 'StatusTag';
