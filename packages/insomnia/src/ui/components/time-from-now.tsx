import { differenceInMinutes, formatDistanceToNowStrict } from 'date-fns';
import React, { type FC, useState } from 'react';
import * as reactUse from 'react-use';

interface Props {
  timestamp: number | Date | string;
  intervalSeconds?: number;
  className?: string;
  titleCase?: boolean;
  title?: (text: string) => string;
}
const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .split(' ')
    .map(value => value.charAt(0).toUpperCase() + value.slice(1))
    .join(' ');

export function getTimeFromNow(timestamp: string | number | Date, titleCase: boolean): string {
  const date = new Date(timestamp);
  let text = formatDistanceToNowStrict(date, { addSuffix: true });
  const now = new Date();
  const lessThanOneMinuteAgo = now > date ? differenceInMinutes(now, date) < 1 : differenceInMinutes(date, now) < 1;
  if (lessThanOneMinuteAgo) {
    text = 'just now';
  }
  if (titleCase) {
    text = toTitleCase(text);
  }
  return text;
}

function useTimeNowLabel(timestamp: number | Date | string, titleCase?: boolean, intervalSeconds?: number): string {
  const [text, setText] = useState(getTimeFromNow(timestamp, Boolean(titleCase)));

  reactUse.useInterval(
    () => {
      const newText = getTimeFromNow(timestamp, Boolean(titleCase));
      setText(newText);
    },
    (intervalSeconds || 5) * 1000,
  );

  return text;
}

/**
  Finds epoch's digit count and converts it to make it exactly 13 digits.
  Which is the epoch millisecond representation. (trims last 2 digits)
*/
export function convertEpochToMilliseconds(epoch: number) {
  epoch = Math.floor(epoch);
  const expDigitCount = epoch.toString().length;
  return Number.parseInt(String(epoch * 10 ** (13 - expDigitCount)), 10);
}

export const TimeFromNow: FC<Props> = ({ className, timestamp, titleCase, title, intervalSeconds }) => {
  const text = useTimeNowLabel(timestamp, titleCase, intervalSeconds);
  return (
    <span title={title ? title(text) : new Date(timestamp).toLocaleString()} className={className}>
      {text}
    </span>
  );
};
