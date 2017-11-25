import React, {Component, PropTypes} from 'react';
import * as session from '../../session';
import {trackEvent} from '../../analytics';

const STATE_DEFAULT = 'default';
const STATE_LOADING = 'loading';
const STATE_DONE = 'done';

class VerifyButton extends Component {
  state = {
    state: STATE_DEFAULT,
    error: '',
  };

  _noOp = e => e.preventDefault();

  _handleClick = async e => {
    e.preventDefault();
    this.setState({state: STATE_LOADING});

    try {
      await session.verify();
      trackEvent('Account', 'Resend Verification Email');
      this.setState({state: STATE_DONE});
    } catch (err) {
      this.setState({error: err.message})
    }
  };

  render () {
    const {state, error} = this.state;

    if (error) {
      return (
        <a href="#" onClick={this._noOp} {...this.props}>
          {error}
        </a>
      )
    }

    if (state === STATE_LOADING) {
      return (
        <a href="#" onClick={this._noOp} disabled {...this.props}>
          Loading...
        </a>
      )
    } else if (state === STATE_DONE) {
      return (
        <a href="#" onClick={this._noOp} {...this.props}>
          Verification Email Sent
        </a>
      )
    } else {
      return (
        <a href="#" onClick={this._handleClick} {...this.props}>
          Resend Verification Email
        </a>
      )
    }
  }
}

VerifyButton.propTypes = {};

export default VerifyButton;
