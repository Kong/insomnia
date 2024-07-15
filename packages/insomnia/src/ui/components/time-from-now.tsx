import { differenceInMinutes, formatDistanceToNowStrict } from 'date-fns';
import React, { type FC, useState } from 'react';
import { useInterval } from 'react-use';

interface Props {
  timestamp: number | Date | string;
  intervalSeconds?: number;
  className?: string;
  titleCase?: boolean;
  title?: (text: string) => string;
}
const toTitleCase = (value: string) => (
  value
    .toLowerCase()
    .split(' ')
    .map(value => value.charAt(0).toUpperCase() + value.slice(1))
    .join(' ')
);

export function getTimeFromNow(timestamp: string | number | Date, titleCase: boolean): string {
  const date = new Date(timestamp);
  let text = formatDistanceToNowStrict(date, { addSuffix: true });
  const now = new Date();
  let lessThanOneMinuteAgo;
  if (now > date) {
    lessThanOneMinuteAgo = differenceInMinutes(now, date) < 1;
  } else {
    lessThanOneMinuteAgo = differenceInMinutes(date, now) < 1;
  }
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
  title,
  intervalSeconds,
}) => {
  const text = useTimeNowLabel(timestamp, titleCase, intervalSeconds);
  return (
    <span title={title ? title(text) : new Date(timestamp).toLocaleString()} className={className}>
      {text}
    </span>
  );
};
