import React, { FC, Fragment, useState } from 'react';
import { useSelector } from 'react-redux';

import * as session from '../../../account/session';
import { selectSettings } from '../../redux/selectors';
import { Link } from '../base/link';
import { PromptButton } from '../base/prompt-button';
import { HelpTooltip } from '../help-tooltip';
import { hideAllModals, showModal } from '../modals/index';
import { LoginModal } from '../modals/login-modal';

export const Account: FC = () => {
  const settings = useSelector(selectSettings);
  const disablePaidFeatureAds = settings.disablePaidFeatureAds;
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [error, setError] = useState('');
  const [finishedResetting, setFinishedResetting] = useState(false);

  async function handleShowChangePasswordForm() {
    setShowChangePassword(!showChangePassword);
    setFinishedResetting(false);
  }

  function handleChangeCode(event: React.SyntheticEvent<HTMLInputElement>) {
    setCode(event.currentTarget.value);
  }

  function handleChangePassword(event: React.SyntheticEvent<HTMLInputElement>) {
    setPassword(event.currentTarget.value);
  }

  function handleChangePassword2(event: React.SyntheticEvent<HTMLInputElement>) {
    setPassword2(event.currentTarget.value);
  }

  async function handleSubmitPasswordChange(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    let error = '';

    if (password !== password2) {
      error = 'Passwords did not match';
    } else if (!code) {
      error = 'Code was not provided';
    }

    if (error) {
      setError(error);
      return;
    }

    try {
      await session.changePasswordWithToken(password, code);
    } catch (err) {
      setError(err.message);
      return;
    }
    setError('');
    setFinishedResetting(true);
    setShowChangePassword(false);
  }

  async function handleLogout() {
    await session.logout();
  }

  function handleLogin(event: React.SyntheticEvent<HTMLAnchorElement>) {
    event.preventDefault();
    hideAllModals();
    showModal(LoginModal);
  }

  async function _sendCode() {
    try {
      await session.sendPasswordChangeCode();
    } catch (err) {
      setError(err.message);
      return;
    }
    setCodeSent(true);
  }

  async function handleSendCode(event: React.SyntheticEvent<HTMLAnchorElement>) {
    event.preventDefault();
    await _sendCode();
  }

  return session.isLoggedIn() ? (
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
        <PromptButton className="space-left btn btn--clicky" onClick={handleLogout}>
          Sign Out
        </PromptButton>
        <button
          className="space-left btn btn--clicky"
          onClick={handleShowChangePasswordForm}
        >
          Change Password
        </button>
      </div>

      {finishedResetting && (
        <p className="notice surprise">Your password was changed successfully</p>
      )}

      {showChangePassword && (
        <form onSubmit={handleSubmitPasswordChange} className="pad-top">
          <hr />
          {error && <p className="notice error">{error}</p>}
          <div className="form-control form-control--outlined">
            <label>
              New Password
              <input
                type="password"
                placeholder="•••••••••••••••••"
                onChange={handleChangePassword}
              />
            </label>
          </div>
          <div className="form-control form-control--outlined">
            <label>
              Confirm Password
              <input
                type="password"
                placeholder="•••••••••••••••••"
                onChange={handleChangePassword2}
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
                onChange={handleChangeCode}
              />
            </label>
          </div>
          <div className="row-spaced row--top">
            <div>
              {codeSent ? 'A code was sent to your email' : 'Looking for a code?'}{' '}
              <Link href="#" onClick={handleSendCode}>
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
  ) : (disablePaidFeatureAds ? (
    <a href="#" onClick={handleLogin} className="theme--link">
      Log In
    </a>
  ) : (
    <Fragment>
      <div className="notice pad surprise">
        <h1 className="no-margin-top">Try Insomnia Plus!</h1>
        <p>
          Sync your data across devices or with a team
          <br />
          Keep synced data safe with end-to-end encryption
          <br />
          Prioritized email support
          <br />
        </p>
        <br />
        <div className="pad">
          <Link button className="btn btn--clicky" href="https://insomnia.rest/pricing">
            View plans <i className="fa fa-external-link" />
          </Link>
        </div>
      </div>
      <p>
        Or{' '}<a href="#" onClick={handleLogin} className="theme--link">
          Log In
        </a>
      </p>
    </Fragment>)
  );
};
