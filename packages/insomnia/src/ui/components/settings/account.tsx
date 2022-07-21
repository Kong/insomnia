import React, { FC, Fragment, useCallback, useState } from 'react';
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
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [error, setError] = useState('');
  const [finishedResetting, setFinishedResetting] = useState(false);

  const handleSubmitPasswordChange = useCallback(async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (password !== password2) {
      setError('Passwords did not match');
      return;
    }
    if (!code) {
      setError('Code was not provided');
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
  }, [code, password, password2]);

  const handleLogin = useCallback((event: React.SyntheticEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    hideAllModals();
    showModal(LoginModal);
  }, []);

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
        <PromptButton className="space-left btn btn--clicky" onClick={() => session.logout()}>
          Sign Out
        </PromptButton>
        <button
          className="space-left btn btn--clicky"
          onClick={() => {
            setShowChangePassword(!showChangePassword);
            setFinishedResetting(false);
          }}
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
                onChange={event => setPassword(event.currentTarget.value)}
              />
            </label>
          </div>
          <div className="form-control form-control--outlined">
            <label>
              Confirm Password
              <input
                type="password"
                placeholder="•••••••••••••••••"
                onChange={event => setPassword2(event.currentTarget.value)}
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
                onChange={event => setCode(event.currentTarget.value)}
              />
            </label>
          </div>
          <div className="row-spaced row--top">
            <div>
              {codeSent ? 'A code was sent to your email' : 'Looking for a code?'}{' '}
              <Link
                href="#"
                onClick={async event => {
                  event.preventDefault();
                  try {
                    await session.sendPasswordChangeCode();
                  } catch (err) {
                    setError(err.message);
                    return;
                  }
                  setCodeSent(true);
                }}
              >
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
  ) : (settings.disablePaidFeatureAds ? (
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
