import { differenceInMinutes, formatDistanceToNowStrict } from 'date-fns';
import React, { FC, useState } from 'react';
import { useInterval } from 'react-use';

import { toTitleCase } from '../../common/misc';

interface Props {
  timestamp: number | Date | string;
  intervalSeconds?: number;
  className?: string;
  titleCase?: boolean;
}

export const TimeFromNow: FC<Props> = ({ className, timestamp, titleCase, intervalSeconds }) => {
  const [text, setText] = useState('');
  useInterval(() => {
    const date = new Date(timestamp);
    let text = formatDistanceToNowStrict(date, { addSuffix: true });
    const lessThanOneMinuteAgo = differenceInMinutes(Date.now(), date) < 1;
    if (lessThanOneMinuteAgo) {
      text = 'just now';
    }
    if (titleCase) {
      text = toTitleCase(text);
    }
    setText(text);
  }, (intervalSeconds || 5) * 1000);

  return (
    <span title={new Date(timestamp).toLocaleString()} className={className}>
      {text}
    </span>
  );
};
