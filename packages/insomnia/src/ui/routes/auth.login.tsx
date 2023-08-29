import React from 'react';
import { ActionFunction, Form, Link, redirect } from 'react-router-dom';

import { getStagingEnvironmentVariables } from '../../models/environment';
import { getLoginUrl } from '../auth-session-provider';
import { Button } from '../components/themed-button';

const GoogleIcon = (props: React.ReactSVGElement['props']) => {
  return (
    <svg {...props} viewBox="0 0 22 22">
      <path
        d="M19.9885 9.20471H19.2502V9.16667H11.0002V12.8333H16.1807C15.4249 14.9678 13.394 16.5 11.0002 16.5C7.96279 16.5 5.50016 14.0374 5.50016 11C5.50016 7.96263 7.96279 5.5 11.0002 5.5C12.4022 5.5 13.6777 6.02892 14.649 6.89288L17.2417 4.30009C15.6046 2.77429 13.4147 1.83334 11.0002 1.83334C5.93787 1.83334 1.8335 5.93771 1.8335 11C1.8335 16.0623 5.93787 20.1667 11.0002 20.1667C16.0625 20.1667 20.1668 16.0623 20.1668 11C20.1668 10.3854 20.1036 9.78542 19.9885 9.20471Z"
        fill="#FFC107"
      />
      <path
        d="M2.89014 6.73338L5.90185 8.94209C6.71676 6.9245 8.69035 5.5 10.9999 5.5C12.4019 5.5 13.6775 6.02892 14.6487 6.89288L17.2415 4.30009C15.6043 2.77429 13.4144 1.83334 10.9999 1.83334C7.47897 1.83334 4.42555 3.82113 2.89014 6.73338Z"
        fill="#FF3D00"
      />
      <path
        d="M11 20.1667C13.3677 20.1667 15.5191 19.2605 17.1458 17.787L14.3087 15.3863C13.3884 16.0834 12.2444 16.5 11 16.5C8.61573 16.5 6.59127 14.9797 5.82861 12.8581L2.83936 15.1612C4.35644 18.1298 7.43736 20.1667 11 20.1667Z"
        fill="#4CAF50"
      />
      <path
        d="M19.9884 9.20471H19.25V9.16666H11V12.8333H16.1805C15.8175 13.8586 15.158 14.7427 14.3073 15.3867C14.3078 15.3862 14.3083 15.3862 14.3087 15.3858L17.1458 17.7865C16.945 17.969 20.1667 15.5833 20.1667 11C20.1667 10.3854 20.1034 9.78541 19.9884 9.20471Z"
        fill="#1976D2"
      />
    </svg>
  );
};

export const action: ActionFunction = async ({
  request,
}) => {
  const data = await request.formData();
  const provider = data.get('provider');
  const stagingEnv = await getStagingEnvironmentVariables();
  const url = new URL(getLoginUrl(stagingEnv.websiteURL));

  if (typeof provider === 'string' && provider) {
    url.searchParams.set('provider', provider);
  }

  window.main.openInBrowser(url.toString());

  return redirect('/auth/authorize');
};

const Login = () => (
  <Form
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--padding-md)',
    }}
    method="POST"
  >
    <p
      style={{
        textAlign: 'center',
        color: 'var(--color-font)',
        fontSize: 'var(--font-size-xl)',
        padding: '0 var(--padding-md)',
      }}
    >
      Welcome to Insomnia
    </p>
    <Button
      name="provider"
      variant='outlined'
      size="medium"
      type="submit"
      value="google"
      style={{
        width: '100%',
        padding: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          gap: 'var(--padding-md)',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '100%',
            borderRight: '1px solid var(--hl-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--hl-xs)',
          }}
        >
          <GoogleIcon width="1em" />
        </div>
        <span>
          Continue with Google
        </span>
      </div>
    </Button>
    <Button
      name="provider"
      value="github"
      variant='outlined'
      size="medium"
      type="submit"
      style={{
        width: '100%',
        padding: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          gap: 'var(--padding-md)',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '100%',
            borderRight: '1px solid var(--hl-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--hl-xs)',
          }}
        >
          <i className='fa fa-github' />
        </div>
        <span>
          Continue with GitHub
        </span>
      </div>
    </Button>
    <Button
      name="provider"
      value="email"
      variant='outlined'
      size="medium"
      type="submit"
      style={{
        width: '100%',
        padding: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          gap: 'var(--padding-md)',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '100%',
            borderRight: '1px solid var(--hl-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--hl-xs)',
          }}
        >
          <i className='fa fa-envelope' />
        </div>
        <span>
          Continue with Email
        </span>
      </div>
    </Button>

    <Link
      to={'/scratchpad'}
      className='flex transition-colors justify-center text-[rgba(var(--color-font-rgb),0.8)] text-sm gap-[--padding-xs] hover:text-[--color-font] focus:text-[--color-font]'
    >
      <div>
        <i className='fa fa-edit' />
      </div>
      <span>
        Or use the Scratch Pad
      </span>
    </Link>
    <p className='text-[rgba(var(--color-font-rgb),0.8)] text-xs text-center'>
      By signing up or using Insomnia, you agree to the{' '}
      <a
        className='font-bold transition-colors hover:text-[--color-font] focus:text-[--color-font]'
        target="_blank"
        href="https://insomnia.rest/terms"
        rel="noreferrer"
      >
        terms of service
      </a>{' '}
      and{' '}
      <a
        className='font-bold transition-colors hover:text-[--color-font] focus:text-[--color-font]'
        target="_blank"
        href="https://insomnia.rest/privacy"
        rel="noreferrer"
      >
        privacy policy
      </a>
      .
    </p>
  </Form>
);

export default Login;
