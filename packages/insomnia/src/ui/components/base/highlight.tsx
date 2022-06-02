import fuzzySort from 'fuzzysort';
import React, { FC } from 'react';

import { fuzzyMatch } from '../../../common/misc';

interface Props {
  search: string;
  text: string;
  blankValue?: String;
}

export const Highlight: FC<Props> = ({
  search,
  text,
  blankValue,
  ...otherProps
}) => {
  // Match loose here to make sure our highlighting always works
  const result = fuzzyMatch(search, text, {
    splitSpace: true,
    loose: true,
  });

  if (!result) {
    return <span {...otherProps}>{text || blankValue || ''}</span>;
  }

  return (
    <span
      {...otherProps}
      dangerouslySetInnerHTML={{
      // @ts-expect-error -- TSCONVERSION
        __html: fuzzySort.highlight(
        // @ts-expect-error -- TSCONVERSION
          result,
          '<strong style="font-style: italic; text-decoration: underline;">',
          '</strong>'
        ),
      }}
    />
  );
};
