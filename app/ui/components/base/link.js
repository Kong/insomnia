import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import {trackEvent} from '../../../analytics/index';
import * as misc from '../../../common/misc';

@autobind
class Link extends PureComponent {
  _handleClick (e) {
    e && e.preventDefault();
    const {href, onClick} = this.props;

    // Also call onClick that was passed to us if there was one
    onClick && onClick(e);
    misc.clickLink(href);
    trackEvent('Link', 'Click', href);
  }

  render () {
    const {
      onClick, // eslint-disable-line no-unused-vars
      button,
      href,
      children,
      ...other
    } = this.props;
    return button
      ? <button onClick={this._handleClick} {...other}>{children}</button>
      : <a href={href} onClick={this._handleClick} {...other}>{children}</a>;
  }
}

Link.propTypes = {
  href: PropTypes.string.isRequired,

  // Optional
  button: PropTypes.bool,
  onClick: PropTypes.func,
  children: PropTypes.node
};

export default Link;
