// @flow
import * as React from 'react';
import classnames from 'classnames';
import Tooltip from '../tooltip';

type Props = {
  url: string,

  // Optional
  small?: boolean,
  className?: string,
  maxLength?: number,
  method?: string,
};

class URLTag extends React.PureComponent<Props> {
  render() {
    const { url, small, className, maxLength, method } = this.props;

    const max = maxLength || 30;
    let shortUrl = url;

    if (url.length > max) {
      shortUrl = url.slice(0, max - 3) + '…';
    }

    return (
      <div className={classnames('tag', { 'tag--small': small }, className)}>
        <Tooltip message={url} position="bottom">
          <strong>{method || 'URL'}</strong> {shortUrl}
        </Tooltip>
      </div>
    );
  }
}

export default URLTag;
