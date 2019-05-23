// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import * as sync from '../../../sync-legacy/index';
import Link from '../base/link';
import LoginModal from '../modals/login-modal';
import { hideAllModals, showModal } from '../modals/index';
import PromptButton from '../base/prompt-button';
import * as session from '../../../account/session';

type Props = {};

type State = {
  code: string,
  password: string,
  password2: string,
  showChangePassword: boolean,
  codeSent: boolean,
};

@autobind
class Account extends React.PureComponent<Props, State> {
  state = {
    code: '',
    password: '',
    password2: '',
    codeSent: false,
    showChangePassword: false,
  };

  _handleShowChangePasswordForm(e: SyntheticEvent<HTMLInputElement>) {
    this.setState(state => ({ showChangePassword: !state.showChangePassword }));
  }

  _handleChangeCode(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ code: e.currentTarget.value });
  }

  _handleChangePassword(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ password: e.currentTarget.value });
  }

  _handleChangePassword2(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ password2: e.currentTarget.value });
  }

  async _handleSubmitPasswordChange(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();

    session.changePasswordAndEmail();
  }

  async _handleLogout() {
    await sync.logout();
    this.forceUpdate();
  }

  static _handleLogin(e: SyntheticEvent<HTMLButtonElement>) {
    e.preventDefault();
    hideAllModals();
    showModal(LoginModal);
  }

  _handleSendCode(e: SyntheticEvent<HTMLAnchorElement>) {
    e.preventDefault();
    this.setState({ codeSent: true });
  }

  static renderUpgrade() {
    return (
      <React.Fragment>
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
            <Link button className="btn btn--clicky" href="https://insomnia.rest/plus/">
              Plus for Individuals <i className="fa fa-external-link" />
            </Link>
            <Link
              button
              className="margin-left-sm btn btn--clicky"
              href="https://insomnia.rest/teams/">
              Plus for Teams <i className="fa fa-external-link" />
            </Link>
          </div>
        </div>
        <p>
          Or{' '}
          <a href="#" onClick={Account._handleLogin} className="theme--link">
            Login
          </a>
        </p>
      </React.Fragment>
    );
  }

  renderAccount() {
    const { code, password, password2, codeSent, showChangePassword } = this.state;
    return (
      <React.Fragment>
        <div>
          <h2 className="no-margin-top">Welcome {session.getFirstName()}!</h2>
          <p>
            You are currently logged in as{' '}
            <code className="code--compact">{session.getEmail()}</code>
          </p>
          <br />
          <Link button href="https://insomnia.rest/app/" className="btn btn--clicky">
            Manage Account
          </Link>
          <PromptButton className="space-left btn btn--clicky" onClick={this._handleLogout}>
            Sign Out
          </PromptButton>
          <button
            className="space-left btn btn--clicky"
            onClick={this._handleShowChangePasswordForm}>
            Change Password
          </button>
        </div>

        {showChangePassword && (
          <form onSubmit={this._handleSubmitPasswordChange}>
            <hr />
            <div className="form-control form-control--outlined">
              <label>
                New Password
                <input
                  required
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
                  required
                  type="password"
                  placeholder="•••••••••••••••••"
                  onChange={this._handleChangePassword2}
                />
              </label>
            </div>
            <div className="form-control form-control--outlined">
              <label>
                Confirmation Code
                <input
                  type="text"
                  defaultValue={code}
                  placeholder="123456"
                  onChange={this._handleChangeCode}
                />
              </label>
            </div>
            <div className="row row-spaced">
              <p className="txt-sm">
                Don't have a code yet?{' '}
                {codeSent ? (
                  <Link href="#" onClick={this._handleSendCode} disabled>
                    Sent!
                  </Link>
                ) : (
                  <Link href="#" onClick={this._handleSendCode}>
                    Send to {session.getEmail()}
                  </Link>
                )}
              </p>
              <div className="text-right">
                <button
                  type="submit"
                  className="btn btn--clicky"
                  disabled={!code || !password || password !== password2}>
                  Submit
                </button>
              </div>
            </div>
          </form>
        )}
      </React.Fragment>
    );
  }

  render() {
    return session.isLoggedIn() ? this.renderAccount() : Account.renderUpgrade();
  }
}

export default Account;
