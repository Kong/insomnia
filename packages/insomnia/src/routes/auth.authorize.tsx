import { getVault } from 'insomnia-api';
import { Fragment } from 'react';
import { Button, Heading } from 'react-aria-components';
import { href, redirect, useFetchers, useNavigate } from 'react-router';

import { services } from '~/insomnia-data';
import { AnalyticsEvent } from '~/ui/analytics';
import { getLoginUrl, submitAuthCode } from '~/ui/auth-session-provider.client';
import { Icon } from '~/ui/components/icon';
import { validateVaultKey } from '~/ui/vault-key.client';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';
import { getVaultKeyFromStorage } from '~/utils/vault';

import type { Route } from './+types/auth.authorize';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = await request.json();

  invariant(typeof data?.code === 'string', 'Expected code to be a string');
  const error = await submitAuthCode(data.code);
  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    const humanReadableError =
      errorMessage === 'Failed to fetch'
        ? 'Network failed, please try again. If the problem persists, check your network and proxy settings.'
        : errorMessage;
    return {
      errors: {
        message: humanReadableError,
      },
    };
  }
  console.log('Login successful');
  window.main.trackAnalyticsEvent({
    event: AnalyticsEvent.loginSuccess,
  });
  window.localStorage.setItem('hasUserLoggedInBefore', 'true');
  const userSession = await services.userSession.get();
  const { accountId, id: sessionId } = userSession;
  try {
    // check vault salt exists in server
    const { salt: vaultSalt } = await getVault({ sessionId });
    if (vaultSalt) {
      // save vault salt to session
      await services.userSession.update({ vaultSalt });
      // get vault key saved in local
      const localVaultKey = await getVaultKeyFromStorage(accountId);
      if (localVaultKey) {
        // validate vault key with server
        const validateResult = await validateVaultKey(userSession, localVaultKey, vaultSalt);
        if (validateResult) {
          // Encrypt vault key and save encrypted vault key & raw vault salt to session
          const encryptedVaultKey = await window.main.secretStorage.encryptString(localVaultKey);
          await services.userSession.update({ vaultKey: encryptedVaultKey, vaultSalt });
        }
      }
    }
  } catch (err) {
    console.error(err);
  }

  return redirect('/organization');
}

export const useAuthorizeActionFetcher = createFetcherSubmitHook(
  submit => (data: { code: string }) => {
    submit(data, {
      action: href('/auth/authorize'),
      method: 'POST',
      encType: 'application/json',
    });
  },
  clientAction,
);

const Component = () => {
  const url = getLoginUrl();
  const copyUrl = () => {
    window.clipboard.writeText(url);
  };

  const authorizeFetcher = useAuthorizeActionFetcher();
  const navigate = useNavigate();

  const allFetchers = useFetchers();
  const authFetchers = allFetchers.filter(f => f.formAction === href('/auth/authorize'));

  const isAuthenticating = authFetchers.some(f => f.state !== 'idle');
  // 1 first time sign up
  // 2 login and migration
  // 3 login and redirect back with token
  return (
    <div className="flex flex-col gap-(--padding-md) text-(--color-font)">
      <Heading className="px-3 text-center text-2xl font-bold">Authorizing Insomnia</Heading>
      {
        <Fragment>
          <p>
            A new page should have opened in your default web browser. Please log in. If you choose to login with SSO
            and it uses a different email to your previous login your teams will not be migrated.
          </p>
          <div className="flex flex-col gap-3 rounded-md bg-(--hl-sm) p-(--padding-md)">
            <p className="text-start text-[rgba(var(--color-font-rgb),0.8)]">
              If you were not redirected back here after creating an account, please copy and paste the following URL
              into your browser to complete login.
            </p>
            <div className="form-control form-control--outlined no-pad-top flex">
              <input type="text" value={url} style={{ marginRight: 'var(--padding-sm)' }} readOnly />
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
            <p className="text-start text-[rgba(var(--color-font-rgb),0.8)]">
              If your browser does not open the Insomnia app automatically you can manually add the generated token
              here.
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
                });
              }}
            >
              <div className="form-control form-control--outlined no-pad-top" style={{ display: 'flex' }}>
                <input type="text" name="code" style={{ marginRight: 'var(--padding-sm)' }} />
                <button
                  className="btn btn--super-compact btn--outlined"
                  type="submit"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--padding-xs)',
                  }}
                  disabled={isAuthenticating}
                >
                  <Icon
                    icon={isAuthenticating ? 'spinner' : 'sign-in'}
                    className={isAuthenticating ? 'animate-spin' : ''}
                  />
                  Log in
                </button>
              </div>
              {authorizeFetcher.data?.errors?.message && <p>{authorizeFetcher.data.errors.message}</p>}
            </form>
          </div>
        </Fragment>
      }
      <div className="flex w-full justify-center">
        <Button
          className="flex items-center gap-2"
          onPress={() => {
            navigate(href('/auth/login'));
          }}
        >
          <Icon icon="arrow-left" />
          <span>Go Back</span>
        </Button>
      </div>
    </div>
  );
};

export default Component;
