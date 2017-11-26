import React, {Component, PropTypes} from 'react';
import * as session from '../../session';
import {trackEvent} from '../../analytics';

class CancelLink extends Component {
  _handleClick = async e => {
    e.preventDefault();

    const confirmed = confirm(
      'Are you sure? Your subscription will remain active ' +
      'until the end of your current billing period'
    );

    if (!confirmed) {
      trackEvent('Account', 'Cancel Cancelled');
      return;
    }

    await session.cancelAccount();
    trackEvent('Account', 'Cancel');
    window.location.reload();
  };

  render () {
    return <a href="#" onClick={this._handleClick}>Cancel Subscription</a>
  }
}

CancelLink.propTypes = {};

export default CancelLink;
