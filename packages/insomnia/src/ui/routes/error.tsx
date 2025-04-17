import type { FC } from 'react';
import React from 'react';
import { Button } from 'react-aria-components';
import { isRouteErrorResponse, useFetcher, useNavigate, useNavigation, useRouteError } from 'react-router';

import { Icon } from '../components/icon';

export const ErrorRoute: FC<{ defaultMessage?: string }> = ({ defaultMessage }) => {
  const error = useRouteError();
  const getErrorMessage = (err: any) => {
    if (isRouteErrorResponse(err)) {
      return err.data;
    }

    if (err?.message) {
      return err?.message;
    }

    if (defaultMessage) {
      return defaultMessage;
    }

    return 'Unknown error';
  };

  const getErrorStack = (err: any) => {
    if ('error' in err) {
      return err.error?.stack;
    }

    return err?.stack;
  };

  const navigate = useNavigate();
  const navigation = useNavigation();
  const errorMessage = getErrorMessage(error);
  const logoutFetcher = useFetcher();

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden">
      <h1 className="flex items-center gap-2 text-2xl text-[--color-font]">
        <Icon className="text-[--color-danger]" icon="exclamation-triangle" /> Application Error
      </h1>
      <p className="text-[--color-font]">
        Failed to render. Please report to{' '}
        <a className="font-bold underline" href="https://github.com/Kong/insomnia/issues">
          our Github Issues
        </a>
      </p>
      <div className="p-6 text-[--color-font]">
        <code className="break-words p-2">{errorMessage}</code>
      </div>
      <div className="flex items-center gap-2">
        <Button
          className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-base font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
          onPress={() => navigate('/organization')}
        >
          Try to reload the app{' '}
          <span>{navigation.state === 'loading' ? <Icon icon="spinner" className="animate-spin" /> : null}</span>
        </Button>
        <Button
          className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-base font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
          onPress={() =>
            logoutFetcher.submit(
              {},
              {
                action: '/auth/logout',
                method: 'POST',
              },
            )
          }
        >
          Logout{' '}
          <span>{logoutFetcher.state === 'loading' ? <Icon icon="spinner" className="animate-spin" /> : null}</span>
        </Button>
      </div>
      <div className="overflow-y-auto p-6 text-[--color-font]">
        <code className="break-all p-2">{getErrorStack(error)}</code>
      </div>
    </div>
  );
};
