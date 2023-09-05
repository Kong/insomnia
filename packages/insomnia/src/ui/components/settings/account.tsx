import React, { FC, Fragment } from 'react';
import { useFetcher, useNavigate } from 'react-router-dom';

import { getEmail } from '../../../account/session';
import { useOrganizationLoaderData } from '../../routes/organization';
import { useRootLoaderData } from '../../routes/root';
import { Link } from '../base/link';
import { PromptButton } from '../base/prompt-button';
import { Button } from '../themed-button';

interface Props {
  user: {
    name: string;
    email: string;
  };
}

export const AccountSettings: FC<Props> = ({ user }) => {
  const { env } = useRootLoaderData();

  const logoutFetcher = useFetcher();

  return (
    <Fragment>
      <div>
        <h2 className="no-margin-top">Welcome {user.name}!</h2>
        <p>
          You are currently logged in as{' '}
          <code className="code--compact">{getEmail()}</code>
        </p>
        <br />
        <Link button href={`${env.websiteURL}/app/settings/account`} className="btn btn--clicky">
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
          onClick={() => {
            window.main.openInBrowser(`${env.websiteURL}/app/settings/encryption`);
          }}
        >
          Change Passphrase
        </button>
      </div>
    </Fragment>
  );
};

export const Account = () => {
  const navigate = useNavigate();
  const data = useOrganizationLoaderData();
  if (data?.user) {
    return <AccountSettings user={data.user} />;
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className="border-solid border-[--hl-md] notice surprise p-4 rounded-md">
        Log in to Insomnia to manage your Account
      </div>
      <div className='flex gap-2'>
        <Button
          variant="outlined"
          size="small"
          onClick={
            () => navigate('/auth/login')
          }
        >
          Log in
        </Button>
        <Button
          onClick={() => navigate('/auth/login')}
          size="small"
          variant="contained"
        >
          Sign Up
        </Button>
      </div>
    </div>
  );
};
