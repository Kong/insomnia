// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { getDocumentationUrl } from '../../common/constants';
import Link from './base/link';

type Props = {
  slug: string,
};

@autobind
class HelpLink extends React.PureComponent<Props> {
  render() {
    const { slug } = this.props;
    return (
      <Link
        noTheme
        className="help-link theme--dialog"
        href={getDocumentationUrl(slug)}
        title="Read documentation">
        <i className="fa fa-question-circle" />
      </Link>
    );
  }
}

export default HelpLink;
