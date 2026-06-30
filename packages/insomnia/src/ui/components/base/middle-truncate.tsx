import React, { type FC } from 'react';
import { twMerge } from 'tailwind-merge';

interface Props {
  /** The full text to display; the full value is also used as the hover title. */
  value: string;
  className?: string;
}

/**
 * Renders a file-system-style path truncated in the middle: the leading portion
 * collapses with an ellipsis while the trailing segment (e.g. the folder/repo
 * name) stays visible. The full value is exposed via the `title` attribute so it
 * shows on hover.
 */
export const MiddleTruncate: FC<Props> = ({ value, className }) => {
  const sep = value.includes('\\') ? '\\' : '/';
  const idx = value.lastIndexOf(sep);
  const head = idx >= 0 ? value.slice(0, idx + 1) : '';
  const tail = idx >= 0 ? value.slice(idx + 1) : value;

  return (
    <div title={value} className={twMerge('flex min-w-0 items-center', className)}>
      <span className="truncate">{head}</span>
      {tail && <span className="shrink-0 whitespace-pre">{tail}</span>}
    </div>
  );
};
