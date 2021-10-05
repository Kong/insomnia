import classnames from 'classnames';
import React, { FC, memo } from 'react';

import { Tooltip } from '../tooltip';

interface Props {
  url: string;
  small?: boolean;
  className?: string;
  maxLength?: number;
  method?: string;
  tooltipDelay?: number;
}

export const URLTag: FC<Props> = memo(({
  url,
  small,
  className,
  maxLength,
  method,
  tooltipDelay,
}) => {
  const max = maxLength || 30;
  let shortUrl = url;

  if (url.length > max) {
    shortUrl = url.slice(0, max - 3) + '…';
  }

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
      <Tooltip wide message={url} position="bottom" delay={tooltipDelay}>
        <strong>{method || 'URL'}</strong> {shortUrl}
      </Tooltip>
    </div>
  );
});

URLTag.displayName = 'URLTag';
