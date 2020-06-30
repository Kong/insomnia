// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import fuzzySort from 'fuzzysort';
import { fuzzyMatch } from '../../../common/misc';

type Props = {|
  search: string,
  text: string,
  blankValue?: String,
|};

@autobind
class Highlight extends React.PureComponent<Props> {
  render() {
    const { search, text, blankValue, ...otherProps } = this.props;

    // Match loose here to make sure our highlighting always works
    const result = fuzzyMatch(search, text, { splitSpace: true, loose: true });

    if (!result) {
      return <span {...otherProps}>{text || blankValue || ''}</span>;
    }

    return (
      <span
        {...otherProps}
        dangerouslySetInnerHTML={{
          __html: fuzzySort.highlight(
            result,
            '<strong style="font-style: italic; text-decoration: underline;">',
            '</strong>',
          ),
        }}
      />
    );
  }
}

export default Highlight;
