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

function getTimeFromNow(timestamp: string | number | Date, titleCase: boolean): string {
  const date = new Date(timestamp);
  let text = formatDistanceToNowStrict(date, { addSuffix: true });
  const lessThanOneMinuteAgo = differenceInMinutes(Date.now(), date) < 1;
  if (lessThanOneMinuteAgo) {
    text = 'just now';
  }
  if (titleCase) {
    text = toTitleCase(text);
  }
  return text;
}

function useTimeNowLabel(
  timestamp: number | Date | string,
  titleCase?: boolean,
  intervalSeconds?: number
): string {
  const [text, setText] = useState(getTimeFromNow(timestamp, Boolean(titleCase)));

  useInterval(() => {
    const newText = getTimeFromNow(timestamp, Boolean(titleCase));
    setText(newText);
  }, (intervalSeconds || 5) * 1000);

  return text;
}

export const TimeFromNow: FC<Props> = ({
  className,
  timestamp,
  titleCase,
  intervalSeconds,
}) => {
  const text = useTimeNowLabel(timestamp, titleCase, intervalSeconds);
  return (
    <span title={new Date(timestamp).toLocaleString()} className={className}>
      {text}
    </span>
  );
};
