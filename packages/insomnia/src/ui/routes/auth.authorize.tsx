import React, { Fragment } from 'react';
import { Heading } from 'react-aria-components';
import { ActionFunction, redirect, useFetcher, useFetchers, useNavigate } from 'react-router-dom';

import { isLoggedIn } from '../../account/session';
import { shouldRunMigration } from '../../sync/vcs/migrate-to-cloud-projects';
import { invariant } from '../../utils/invariant';
import { getLoginUrl, submitAuthCode } from '../auth-session-provider';
import { Icon } from '../components/icon';
import { Button } from '../components/themed-button';

export const action: ActionFunction = async ({
  request,
}) => {
  const data = await request.json();

  invariant(typeof data?.code === 'string', 'Expected code to be a string');
  const fetchError = await submitAuthCode(data.code);
  if (fetchError) {
    return {
      errors: {
        message: 'Invalid code: ' + fetchError,
      },
    };
  }
  console.log('Login successful');
  window.localStorage.setItem('hasLoggedIn', 'true');

  if (isLoggedIn() && await shouldRunMigration()) {
    throw redirect('/auth/migrate');
  }

  return redirect('/organization');
};

const Authorize = () => {
  const url = getLoginUrl();
  const copyUrl = () => {
    window.clipboard.writeText(url);
  };

  const authorizeFetcher = useFetcher();
  const navigate = useNavigate();

  const allFetchers = useFetchers();
  const authFetchers = allFetchers.filter(f => f.formAction === '/auth/authorize');

  const isAuthenticating = authFetchers.some(f => f.state !== 'idle');
  // 1 first time sign up
  // 2 login and migration
  // 3 login and redirect back with token
  return (
    <div className="flex flex-col gap-[--padding-md] text-[--color-font]">
      <Heading className="text-2xl font-bold text-center px-3">
        Authorizing Insomnia
      </Heading>
      {!isAuthenticating && (
        <Fragment>
          <p>
            A new page should have opened in your default web browser. Please log in.
            If you choose to login with SSO and it uses a different email to your previous login your teams will not be migrated.
          </p>
          <div className="flex flex-col gap-3 rounded-md bg-[--hl-sm] p-[--padding-md]">
            <p className="text-[rgba(var(--color-font-rgb),0.8))] text-start">
              If you were not redirected back here after creating an account, please copy and paste the following URL
              into your browser to complete login.
            </p>
            <div className="form-control form-control--outlined no-pad-top flex">
              <input
                type="text"
                value={url}
                style={{ marginRight: 'var(--padding-sm)' }}
                readOnly
              />
              <button
                className="btn btn--super-compact btn--outlined"
                onClick={copyUrl}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--padding-xs)',
                }}
              >
                <i className="fa fa-clipboard" aria-hidden="true" />
                Copy
              </button>
            </div>
            <p className="text-[rgba(var(--color-font-rgb),0.8))] text-start">
              If your browser does not open the Insomnia app automatically you
              can manually add the generated token here.
            </p>

            <form
              onSubmit={e => {
                e.preventDefault();
                const form = e.currentTarget;
                const data = new FormData(form);

                const code = data.get('code');
                invariant(
                  typeof code === 'string',
                  'Expected code to be a string',
                );
                authorizeFetcher.submit(
                  {
                    code,
                  },
                  {
                    method: 'POST',
                    encType: 'application/json',
                  },
                );
              }}
            >
              <div
                className="form-control form-control--outlined no-pad-top"
                style={{ display: 'flex' }}
              >
                <input
                  type="text"
                  name="code"
                  style={{ marginRight: 'var(--padding-sm)' }}
                />
                <button
                  className="btn btn--super-compact btn--outlined"
                  type="submit"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--padding-xs)',
                  }}
                >
                  <i className="fa fa-sign-in" aria-hidden="true" />
                  Log in
                </button>
              </div>
              {authorizeFetcher.data?.errors?.message && <p>{authorizeFetcher.data.errors.message}</p>}
            </form>
          </div>
        </Fragment>
      )}
      {isAuthenticating && (
        <div className="flex flex-col gap-3 rounded-md bg-[--hl-sm] p-[--padding-md]">
          <Heading className="text-lg flex items-center p-8 gap-8">
            <i className="fa fa-spinner fa-spin" aria-hidden="true" />
            Authenticating...
          </Heading>
        </div>
      )}
      <div className='flex justify-center w-full'>
        <Button
          variant="text"
          style={{
            gap: 'var(--padding-xs)',
          }}
          onClick={() => {
            navigate('/auth/login');
          }}
        >
          <Icon icon="arrow-left" />
          <span>Go Back</span>
        </Button>
      </div>
    </div>
  );
};

export default Authorize;
