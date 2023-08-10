import React, { FC, Fragment, useCallback, useState } from 'react';
import { useFetcher } from 'react-router-dom';

import * as session from '../../../account/session';
import { Link } from '../base/link';
import { PromptButton } from '../base/prompt-button';
import { HelpTooltip } from '../help-tooltip';

export const Account: FC = () => {
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [finishedResetting, setFinishedResetting] = useState(false);

  const handleSubmitPasswordChange = useCallback(async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    const code = formData.get('code') as string;
    setError('');
    if (!password) {
      setError('Password was not provided');
      return;
    }
    if (password !== confirmPassword) {
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
  }, []);

  const openChangePasswordDialog = useCallback(() => {
    setShowChangePassword(!showChangePassword);
    setFinishedResetting(false);
  }, [showChangePassword]);

  const logoutFetcher = useFetcher();

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
        <PromptButton
          className="space-left btn btn--clicky"
          onClick={() => {
            logoutFetcher.submit({}, {
              action: '/auth/logout',
              method: 'POST',
            });
          }}
        >
          Sign Out
        </PromptButton>
        <button
          className="space-left btn btn--clicky"
          onClick={openChangePasswordDialog}
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
                name="password"
                type="password"
                placeholder="•••••••••••••••••"
              />
            </label>
          </div>
          <div className="form-control form-control--outlined">
            <label>
              Confirm Password
              <input
                name="confirmPassword"
                type="password"
                placeholder="•••••••••••••••••"
              />
            </label>
          </div>
          <div className="form-control form-control--outlined">
            <label>
              Confirmation Code{' '}
              <HelpTooltip>A confirmation code has been sent to your email address</HelpTooltip>
              <input
                name="code"
                type="text"
                placeholder="aa8b0d1ea9"
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
                    session.sendPasswordChangeCode();
                  } catch (err) {
                    setError(err.message);
                    return;
                  }
                  setCodeSent(true);
                  setError('');
                }}
              >
                Email Me a Code
              </Link>
            </div>
            <div className="text-right">
              <button
                type="submit"
                className="btn btn--clicky"
              >
                Submit Change
              </button>
            </div>
          </div>
        </form>
      )}
    </Fragment>
  );
};
