import React from 'react';
import { ActionFunction, redirect, useFetcher, useNavigate } from 'react-router-dom';

import FileSystemDriver from '../../sync/store/drivers/file-system-driver';
import { migrateCollectionsIntoRemoteProject } from '../../sync/vcs/migrate-collections';
import { migrateLocalToCloudProjects } from '../../sync/vcs/migrate-to-cloud-projects';
import { VCS } from '../../sync/vcs/vcs';
import { invariant } from '../../utils/invariant';
import { getLoginUrl, submitAuthCode } from '../auth-session-provider';
import { Button } from '../components/themed-button';

export const action: ActionFunction = async ({
  request,
}) => {
  const data = await request.json();

  invariant(typeof data?.code === 'string', 'Expected code to be a string');

  await submitAuthCode(data.code);

  console.log('Login successful');

  const driver = FileSystemDriver.create(process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'));
  await migrateCollectionsIntoRemoteProject(new VCS(driver));
  await migrateLocalToCloudProjects();

  return redirect('/organization');
};

const Authorize = () => {
  const url = getLoginUrl();
  const copyUrl = () => {
    window.clipboard.writeText(url);
  };

  const authorizeFetcher = useFetcher();
  const navigate = useNavigate();

  return (
    <div
      style={{
        color: 'var(--color-font)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--padding-md)',
      }}
    >
      <p
        style={{
          textAlign: 'center',
          color: 'var(--color-font)',
          fontSize: 'var(--font-size-xl)',
          padding: '0 var(--padding-md)',
        }}
      >
        Authorizing Insomnia
      </p>
      <p>
        A new page should have opened in your default web browser.
        To continue, please login via the browser.
      </p>
      <div
        style={{
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--hl-sm)',
          padding: 'var(--padding-md)',
        }}
      >
        <h4
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--padding-xs)',
          }}
        >
          <i className="fa fa-info-circle" aria-hidden="true" />
          If you are facing issues with your browser:
        </h4>
        <p
          style={{
            color: 'rgba(var(--color-font-rgb), 0.8)',
          }}
        >
          If your browser did not open, copy and paste the following URL into your browser:
        </p>
        <div className="form-control form-control--outlined no-pad-top" style={{ 'display': 'flex' }}>
          <input
            type="text"
            value={url}
            style={{ 'marginRight': 'var(--padding-sm)' }}
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
        <p
          style={{
            color: 'rgba(var(--color-font-rgb), 0.8)',
          }}
        >
          If your browser does not open the Insomnia app automatically you can manually add the generated token here:
        </p>
        <form
          onSubmit={e => {
            e.preventDefault();
            const form = e.currentTarget;
            const data = new FormData(form);

            const code = data.get('code');
            invariant(typeof code === 'string', 'Expected code to be a string');
            authorizeFetcher.submit({
              code,
            }, {
              method: 'POST',
              encType: 'application/json',
            });
          }}
        >
          <div className="form-control form-control--outlined no-pad-top" style={{ 'display': 'flex' }}>
            <input
              type="text"
              name="code"
              style={{ 'marginRight': 'var(--padding-sm)' }}
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
              Login
            </button>
          </div>
        </form>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <Button
          variant='text'
          style={{
            gap: 'var(--padding-xs)',
          }}
          onClick={() => {
            navigate('/auth/login');
          }}
        >
          <i className='fa fa-arrow-left' /> Go Back
        </Button>
      </div>
    </div>
  );
};

export default Authorize;
