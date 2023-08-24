import React, { Fragment } from 'react';
import { Heading } from 'react-aria-components';
import { ActionFunction, redirect, useFetcher, useFetchers, useNavigate } from 'react-router-dom';

import FileSystemDriver from '../../sync/store/drivers/file-system-driver';
import { migrateCollectionsIntoRemoteProject } from '../../sync/vcs/migrate-collections';
import { migrateLocalToCloudProjects } from '../../sync/vcs/migrate-to-cloud-projects';
import { VCS } from '../../sync/vcs/vcs';
import { invariant } from '../../utils/invariant';
import { getLoginUrl, submitAuthCode } from '../auth-session-provider';
import { Button } from '../components/themed-button';
import { useRootLoaderData } from './root';

export const action: ActionFunction = async ({
  request,
}) => {
  const data = await request.json();

  invariant(typeof data?.code === 'string', 'Expected code to be a string');

  await submitAuthCode(data.code);

  console.log('Login successful');
  window.localStorage.setItem('hasLoggedIn', 'true');

  const driver = FileSystemDriver.create(process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'));
  await migrateCollectionsIntoRemoteProject(new VCS(driver));
  await migrateLocalToCloudProjects();

  return redirect('/organization');
};

const Authorize = () => {
  const { env } = useRootLoaderData();
  const url = getLoginUrl(env.websiteURL);
  const copyUrl = () => {
    window.clipboard.writeText(url);
  };

  const authorizeFetcher = useFetcher();
  const navigate = useNavigate();

  const allFetchers = useFetchers();
  const authFetchers = allFetchers.filter(f => f.formAction === '/auth/authorize');

  const isAuthenticating = authFetchers.some(f => f.state !== 'idle');

  return (
    <div className="flex flex-col gap-[--padding-md] text-[--color-font]">
      <Heading className="text-2xl font-bold text-center px-3">
        Authorizing Insomnia
      </Heading>
      {!isAuthenticating && (
        <Fragment>
          <p>
            A new page should have opened in your default web browser. To
            continue, please log in via the browser.
          </p>
          <div className="flex flex-col gap-3 rounded-md bg-[--hl-sm] p-[--padding-md]">
            <Heading className="flex gap-[--padding-xs] items-center">
              <i className="fa fa-info-circle" aria-hidden="true" />
              If you are facing issues with your browser:
            </Heading>
            <p className="text-[rgba(var(--color-font-rgb),0.8))] text-start">
              If your browser did not open, copy and paste the following URL
              into your browser:
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
              can manually add the generated token here:
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
            </form>
          </div>
        </Fragment>
      )}
      {isAuthenticating && (
        <div className="flex flex-col gap-3 rounded-md bg-[--hl-sm] p-[--padding-md]">
          <Heading className="text-lg flex items-center p-8 gap-8">
            <i className="fa fa-spinner fa-spin" aria-hidden="true" />
            Authenticating
          </Heading>
        </div>
      )}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <Button
          variant="text"
          style={{
            gap: 'var(--padding-xs)',
          }}
          onClick={() => {
            navigate('/auth/login');
          }}
        >
          <i className="fa fa-arrow-left" /> Go Back
        </Button>
      </div>
    </div>
  );
};

export default Authorize;
