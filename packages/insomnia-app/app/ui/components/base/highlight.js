// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import fuzzysort from 'fuzzysort';
import {fuzzyMatch} from '../../../common/misc';

type Props = {|
  search: string,
  text: string,
|};

@autobind
class Highlight extends React.PureComponent<Props> {
  render () {
    const results = fuzzyMatch(this.props.search, this.props.text);

    if (results.searchTermsMatched === 0) {
      return <span>{this.props.text}</span>;
    }

    return <span
      className=''
      dangerouslySetInnerHTML={{ __html: fuzzysort.highlight(results,
        '<strong style="color: #695eb8; text-decoration: underline;">',
        '</strong>') }}
    />;
  }
}

export default Highlight;
