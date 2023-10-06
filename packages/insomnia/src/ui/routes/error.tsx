import React from 'react';
import { FC } from 'react';
import { Button } from 'react-aria-components';
import {
  isRouteErrorResponse,
  useFetcher,
  useNavigate,
  useNavigation,
  useRouteError,
} from 'react-router-dom';

import { Icon } from '../components/icon';

export const ErrorRoute: FC = () => {
  const error = useRouteError();
  const getErrorMessage = (err: any) => {
    if (isRouteErrorResponse(err)) {
      return err.data;
    }
    if (err instanceof Error) {
      return err.message;
    }

    return err?.message || 'Unknown error';
  };
  const getErrorStack = (err: any) => {
    if (isRouteErrorResponse(err)) {
      return err.error?.stack;
    }
    return err?.stack;
  };

  const navigate = useNavigate();
  const navigation = useNavigation();
  const errorMessage = getErrorMessage(error);
  const logoutFetcher = useFetcher();

  return (
    <div className="flex gap-2 flex-col items-center justify-center h-full w-full overflow-hidden">
      <h1 className='text-[--color-font] text-2xl flex items-center gap-2'><Icon className='text-[--color-danger]' icon="exclamation-triangle" /> Application Error</h1>
      <p className='text-[--color-font]'>
        Failed to render. Please report to <a className='font-bold underline' href="https://github.com/Kong/insomnia/issues">our Github Issues</a>
      </p>
      <div className='text-[--color-font] p-6'>
        <code className="break-words p-2">{errorMessage}</code>
      </div>
      <div className='flex gap-2 items-center'>
        <Button className="px-4 py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-base" onPress={() => navigate('/organization')}>
          Try to reload the app{' '}
          <span>{navigation.state === 'loading' ? <Icon icon="spinner" className='animate-spin' /> : null}</span>
        </Button>
        <Button
          className="px-4 py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-base"
          onPress={() => logoutFetcher.submit(
            {},
            {
              action: '/auth/logout',
              method: 'POST',
            },
          )}
        >
          Logout{' '}
          <span>{navigation.state === 'loading' ? <Icon icon="spinner" className='animate-spin' /> : null}</span>
        </Button>
      </div>
      <div className='text-[--color-font] p-6 overflow-y-auto'>
        <code className="break-all p-2">{getErrorStack(error)}</code>
      </div>
    </div>
  );
};
