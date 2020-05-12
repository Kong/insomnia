// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Link from './base/link';
import type { DocumentationArticleType } from '../../common/documentation';
import { getDocumentationUrl } from '../../common/documentation';

type Props = {
  article: DocumentationArticleType,
};

@autobind
class HelpLink extends React.PureComponent<Props> {
  render() {
    const { article } = this.props;
    return (
      <Link
        noTheme
        className="help-link theme--dialog"
        href={getDocumentationUrl(article)}
        title="Read documentation">
        <i className="fa fa-question-circle" />
      </Link>
    );
  }
}

export default HelpLink;
