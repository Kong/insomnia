import React, {Component} from 'react';
import * as session from '../../session';
import {trackEvent} from '../../analytics';

class SignOutLink extends Component {
  _handleClick = async e => {
    e.preventDefault();
    await session.logout();
    trackEvent('Account', 'Logout');
    window.location = '/app/logout/';
  };

  render () {
    return <a href="#" onClick={this._handleClick}>Sign Out</a>
  }
}

SignOutLink.propTypes = {};

export default SignOutLink;
