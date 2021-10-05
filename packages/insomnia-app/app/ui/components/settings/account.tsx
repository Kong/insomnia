import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { Fragment, PureComponent } from 'react';

import * as session from '../../../account/session';
import { AUTOBIND_CFG } from '../../../common/constants';
import { Link } from '../base/link';
import { PromptButton } from '../base/prompt-button';
import { HelpTooltip } from '../help-tooltip';
import { hideAllModals, showModal } from '../modals/index';
import { LoginModal } from '../modals/login-modal';

interface State {
  code: string;
  password: string;
  password2: string;
  showChangePassword: boolean;
  codeSent: boolean;
  error: string;
  finishedResetting: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class Account extends PureComponent<{}, State> {
  state: State = {
    code: '',
    password: '',
    password2: '',
    codeSent: false,
    showChangePassword: false,
    error: '',
    finishedResetting: false,
  };

  async _handleShowChangePasswordForm() {
    this.setState(state => ({
      showChangePassword: !state.showChangePassword,
      finishedResetting: false,
    }));
  }

  _handleChangeCode(e: React.SyntheticEvent<HTMLInputElement>) {
    this.setState({
      code: e.currentTarget.value,
    });
  }

  _handleChangePassword(e: React.SyntheticEvent<HTMLInputElement>) {
    this.setState({
      password: e.currentTarget.value,
    });
  }

  _handleChangePassword2(e: React.SyntheticEvent<HTMLInputElement>) {
    this.setState({
      password2: e.currentTarget.value,
    });
  }

  async _handleSubmitPasswordChange(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    this.setState({
      error: '',
    });
    const { password, password2, code } = this.state;
    let error = '';

    if (password !== password2) {
      error = 'Passwords did not match';
    } else if (!code) {
      error = 'Code was not provided';
    }

    if (error) {
      this.setState({
        error,
      });
      return;
    }

    try {
      await session.changePasswordWithToken(password, code);
    } catch (err) {
      this.setState({
        error: err.message,
      });
      return;
    }

    this.setState({
      error: '',
      finishedResetting: true,
      showChangePassword: false,
    });
  }

  async _handleLogout() {
    await session.logout();
    this.forceUpdate();
  }

  static _handleLogin(e: React.SyntheticEvent<HTMLAnchorElement>) {
    e.preventDefault();
    hideAllModals();
    showModal(LoginModal);
  }

  async _sendCode() {
    try {
      await session.sendPasswordChangeCode();
    } catch (err) {
      this.setState({
        error: err.message,
      });
      return;
    }

    this.setState({
      codeSent: true,
    });
  }

  async _handleSendCode(e: React.SyntheticEvent<HTMLAnchorElement>) {
    e.preventDefault();
    await this._sendCode();
  }

  static renderUpgrade() {
    return (
      <Fragment>
        <div className="notice pad surprise">
          <h1 className="no-margin-top">Try Insomnia Plus!</h1>
          <p>
            &#128640; Sync your data across devices or with a team
            <br />
            &#128640; Keep synced data safe with end-to-end encryption
            <br />
            &#128640; Prioritized email support
            <br />
          </p>
          <br />
          <div className="pad">
            <Link button className="btn btn--clicky" href="https://insomnia.rest/pricing">
              Plus for Individuals <i className="fa fa-external-link" />
            </Link>
            <Link
              button
              className="margin-left-sm btn btn--clicky"
              href="https://insomnia.rest/pricing"
            >
              Plus for Teams <i className="fa fa-external-link" />
            </Link>
          </div>
        </div>
        <p>
          Or{' '}
          <a href="#" onClick={Account._handleLogin} className="theme--link">
            Log In
          </a>
        </p>
      </Fragment>
    );
  }

  renderAccount() {
    const {
      code,
      password,
      password2,
      codeSent,
      showChangePassword,
      error,
      finishedResetting,
    } = this.state;
    return (
      <Fragment>
        <div>
          <h2 className="no-margin-top">Welcome {session.getFirstName()}!</h2>
          <p>
            You are currently logged in as{' '}
            <code className="code--compact">{session.getEmail()}</code>
          </p>
          <br />
          <Link button href="https://app.insomnia.rest" className="btn btn--clicky">
            Manage Account
          </Link>
          <PromptButton className="space-left btn btn--clicky" onClick={this._handleLogout}>
            Sign Out
          </PromptButton>
          <button
            className="space-left btn btn--clicky"
            onClick={this._handleShowChangePasswordForm}
          >
            Change Password
          </button>
        </div>

        {finishedResetting && (
          <p className="notice surprise">Your password was changed successfully</p>
        )}

        {showChangePassword && (
          <form onSubmit={this._handleSubmitPasswordChange} className="pad-top">
            <hr />
            {error && <p className="notice error">{error}</p>}
            <div className="form-control form-control--outlined">
              <label>
                New Password
                <input
                  type="password"
                  placeholder="•••••••••••••••••"
                  onChange={this._handleChangePassword}
                />
              </label>
            </div>
            <div className="form-control form-control--outlined">
              <label>
                Confirm Password
                <input
                  type="password"
                  placeholder="•••••••••••••••••"
                  onChange={this._handleChangePassword2}
                />
              </label>
            </div>
            <div className="form-control form-control--outlined">
              <label>
                Confirmation Code{' '}
                <HelpTooltip>A confirmation code has been sent to your email address</HelpTooltip>
                <input
                  type="text"
                  defaultValue={code}
                  placeholder="aa8b0d1ea9"
                  onChange={this._handleChangeCode}
                />
              </label>
            </div>
            <div className="row-spaced row--top">
              <div>
                {codeSent ? 'A code was sent to your email' : 'Looking for a code?'}{' '}
                <Link href="#" onClick={this._handleSendCode}>
                  Email Me a Code
                </Link>
              </div>
              <div className="text-right">
                <button
                  type="submit"
                  className="btn btn--clicky"
                  disabled={!code || !password || password !== password2}
                >
                  Submit Change
                </button>
              </div>
            </div>
          </form>
        )}
      </Fragment>
    );
  }

  render() {
    return session.isLoggedIn() ? this.renderAccount() : Account.renderUpgrade();
  }
}
