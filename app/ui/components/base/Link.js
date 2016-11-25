import React, {Component, PropTypes} from 'react';
import {shell} from 'electron';
import {trackEvent} from '../../../analytics/index';
import * as querystring from '../../../common/querystring';
import {getAppVersion} from '../../../common/constants';
import {isDevelopment} from '../../../common/constants';

class Link extends Component {
  constructor (props) {
    super(props);
    this._boundHandleClick = this._handleClick.bind(this);
  }

  _handleClick (e) {
    e && e.preventDefault();
    const {href} = this.props;
    if (href.match(/^http/i)) {
      const appName = isDevelopment() ? 'Insomnia Dev' : 'Insomnia';
      const qs = `utm_source=${appName}&utm_medium=App&utm_campaign=v${getAppVersion()}`;
      const attributedHref = querystring.joinUrl(href, qs);
      shell.openExternal(attributedHref);
    } else {
      // Don't modify non-http urls
      shell.openExternal(href);
    }

    trackEvent('Link', 'Click', href)
  }

  render () {
    const {onClick, button, href, children, ...other} = this.props;
    return button ? (
      <button onClick={e => {
        onClick && onClick(e);
        this._boundHandleClick(e);
      }} {...other}>
        {children}
      </button>
    ) : (
      <a href={href} onClick={e => {
        onClick && onClick(e);
        this._boundHandleClick(e);
      }} {...other}>
        {children}
      </a>
    )
  }
}

Link.propTypes = {
  href: PropTypes.string.isRequired,

  // Optional
  button: PropTypes.bool
};

export default Link;
