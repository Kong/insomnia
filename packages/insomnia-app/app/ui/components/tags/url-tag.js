// @flow
import * as React from 'react';
import classnames from 'classnames';
import Tooltip from '../tooltip';

type Props = {
  url: string,

  // Optional
  small?: boolean,
  className?: string
};

class URLTag extends React.PureComponent<Props> {
  render () {
    const {
      url,
      small,
      className
    } = this.props;

    let shortUrl = url;

    if (url.length > 40) {
      shortUrl = url.slice(0, 37) + '...';
    }

    return (
      <div className={classnames('tag', {'tag--small': small}, className)}>
        <Tooltip message={url} position="bottom">
          <strong>URL</strong> {shortUrl}
        </Tooltip>
      </div>
    );
  }
}

export default URLTag;
