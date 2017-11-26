import React, {Component, PropTypes} from 'react';
import * as session from '../session';
import {trackEvent} from '../analytics';

class ChangePassword extends Component {
  state = {
    loading: false,
    oldPassword: '',
    newPassword: '',
    confirmNewPassword: '',
    loginError: '',
    error: '',
  };

  _handleUpdateInput = e => {
    this.setState({[e.target.name]: e.target.value, error: ''});
  };

  _handleUpdateConfirmPasswordInput = e => {
    this._handleUpdateInput(e);

    if (this.state.newPassword !== e.target.value) {
      e.target.setCustomValidity('Passwords did not match');
    } else {
      e.target.setCustomValidity('');
    }
  };

  _handleSubmit = async e => {
    e.preventDefault();

    this.setState({loading: true});

    const {whoami} = this.props;

    try {
      await session.login(whoami.email, this.state.oldPassword);
    } catch (err) {
      this.setState({loginError: err.message, error: '', loading: false});
      trackEvent('Account', 'Change Password Error Logging In');
      return;
    }

    try {
      await session.changePasswordAndEmail(
        this.state.oldPassword,
        this.state.newPassword,
        whoami.email
      );
      window.location = '/app/account/';
      trackEvent('Account', 'Change Password Success');
    } catch (err) {
      console.error('Failed to update password', err.stack);
      this.setState({error: err.message, loading: false});
      trackEvent('Account', 'Change Password Error');
    }
  };

  render () {
    const {error, loginError, loading} = this.state;
    return (
      <form onSubmit={this._handleSubmit}>
        <div className="form-control">
          <label>Old Password {loginError ? <small className="error">({loginError})</small> : null}
            <input type="password"
                   name="oldPassword"
                   required
                   autoFocus
                   onChange={this._handleUpdateInput}
                   placeholder="••••••••••"/>
          </label>
        </div>
        <div className="form-control">
          <label>New Password <span className="subtle">(minimum 8 characters)</span>
            <input type="password"
                   pattern=".{8,}"
                   name="newPassword"
                   required
                   onChange={this._handleUpdateInput}
                   placeholder="•••••••••••••••"/>
          </label>
        </div>
        <div className="form-control">
          <label>Confirm New Password
            <input type="password"
                   name="confirmNewPassword"
                   required
                   onChange={this._handleUpdateConfirmPasswordInput}
                   placeholder="•••••••••••••••"/>
          </label>
        </div>
        {error ? <div className="form-control error">** {error}</div> : null}
        <div className="form-control padding-top-sm right">
          {loading ?
            <button type="button" disabled className="button">Updating...</button> :
            <button type="submit" className="button">Update Password</button>
          }
        </div>
      </form>
    )
  }
}

ChangePassword.propTypes = {
  whoami: PropTypes.shape({
    email: PropTypes.string.isRequired,
  }).isRequired
};

export default ChangePassword;
