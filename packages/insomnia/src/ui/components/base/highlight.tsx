import React, { type FC, type ReactNode } from 'react';

import { fuzzyMatch } from '../../../common/misc';

export interface HighlightProps {
  search: string;
  text: string;
  blankValue?: string;
}

export const Highlight: FC<HighlightProps> = ({ search, text, blankValue, ...otherProps }) => {
  const result = fuzzyMatch(search, text, {
    splitSpace: true,
    loose: true,
  });

  if (!result) {
    return <span {...otherProps}>{text || blankValue || ''}</span>;
  }

  const matched = new Set(result.indexes);
  const nodes: ReactNode[] = [];
  let buffer = '';
  let inMatch = false;

  const flush = () => {
    if (!buffer) {
      return;
    }
    nodes.push(
      inMatch
        ? <strong key={nodes.length} className="italic underline">{buffer}</strong>
        : buffer,
    );
    buffer = '';
  };

  for (const [i, char] of [...text].entries()) {
    const isMatch = matched.has(i);
    if (isMatch !== inMatch) {
      flush();
      inMatch = isMatch;
    }
    buffer += char;
  }
  flush();

  return <span {...otherProps}>{nodes}</span>;
};
