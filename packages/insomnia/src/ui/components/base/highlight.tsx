import { autoBindMethodsForReact } from 'class-autobind-decorator';
import fuzzySort from 'fuzzysort';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { fuzzyMatch } from '../../../common/misc';

interface Props {
  search: string;
  text: string;
  blankValue?: String;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class Highlight extends PureComponent<Props> {
  render() {
    const { search, text, blankValue, ...otherProps } = this.props;
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
            '</strong>',
          ),
        }}
      />
    );
  }
}
