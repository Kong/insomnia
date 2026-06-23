import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import type { GitCredentials, GitRepository } from 'insomnia-data';
import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';

import { Banner } from '~/basic-components/banner';
import { Icon } from '~/basic-components/icon';
import {
  GIT_PROVIDER_COMPLETE_SIGN_IN_FETCHER_KEY,
  useGitProviderCompleteSignInFetcher,
} from '~/routes/git-credentials.complete-sign-in';
import { useInitSignInToGitProviderFetcher } from '~/routes/git-credentials.init-sign-in';

import { isOAuthAccessTokenExpired, shouldShowHttp40OAuthReauthHint } from './git-oauth-auth-utils';

const getErrorResult = (data: unknown) => {
  if (data && typeof data === 'object' && 'errors' in data && Array.isArray((data as { errors: unknown }).errors)) {
    const errs = (data as { errors: string[] }).errors;
    if (errs.length > 0) {
      return errs.join(', ');
    }
  }
  return null;
};

export const GitOauthAuthBanner: FC<{
  selectedCredential?: GitCredentials | null;
  gitRepository?: GitRepository | null;
  /** Errors from `git.loadGitRepository` (or similar) when the repo fails to load. */
  repoLoadErrors?: string[];
  provider: {
    type: 'github' | 'gitlab' | 'custom';
    displayName: string;
    iconName?: IconProp;
  };
}> = ({ selectedCredential, gitRepository, repoLoadErrors, provider }) => {
  const [isReauthModalOpen, setIsReauthModalOpen] = useState(false);
  const [error, setError] = useState('');
  const initSignInFetcher = useInitSignInToGitProviderFetcher();
  const completeSignInFetcher = useGitProviderCompleteSignInFetcher({ key: GIT_PROVIDER_COMPLETE_SIGN_IN_FETCHER_KEY });

  const initSignInError = getErrorResult(initSignInFetcher.data);
  const completeSignInError = getErrorResult(completeSignInFetcher.data);

  const prevCompleteSignInStateRef = useRef(completeSignInFetcher.state);
  useEffect(() => {
    const prevState = prevCompleteSignInStateRef.current;
    prevCompleteSignInStateRef.current = completeSignInFetcher.state;

    if (
      (prevState === 'submitting' || prevState === 'loading') &&
      completeSignInFetcher.state === 'idle' &&
      completeSignInFetcher.data &&
      !completeSignInError
    ) {
      setIsReauthModalOpen(false);
      setError('');
    }
  }, [completeSignInFetcher.state, completeSignInFetcher.data, completeSignInError]);

  const expiredByExpiresAt = isOAuthAccessTokenExpired(selectedCredential);
  const http40Fallback =
    !expiredByExpiresAt &&
    shouldShowHttp40OAuthReauthHint({
      errors: repoLoadErrors,
      gitRepository,
      selectedCredential,
    });

  if (!expiredByExpiresAt && !http40Fallback) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <Banner
        type="warning"
        className="gap-2 bg-[rgba(var(--color-danger-rgb),0.5)] p-2 text-(--color-font-danger)"
        message={
          <span>
            This connection has expired.{' '}
            <Button
              type="button"
              className="inline cursor-pointer border-0 bg-transparent p-0 underline"
              onPress={() => {
                setIsReauthModalOpen(true);
                setError('');
                initSignInFetcher.submit({ provider: provider.type });
              }}
            >
              Re-authenticate with {provider.displayName}
            </Button>{' '}
            to continue.
          </span>
        }
      />
      <ModalOverlay
        isOpen={isReauthModalOpen}
        onOpenChange={isOpen => {
          if (!isOpen) {
            setIsReauthModalOpen(false);
            setError('');
          }
        }}
        isDismissable
        className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
      >
        <Modal className="max-h-full w-full max-w-2xl rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)">
          <Dialog className="outline-hidden">
            {({ close }) => (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <Heading className="text-2xl">Re-authenticate {provider.displayName} Credential</Heading>
                  <Button
                    className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                    onPress={close}
                  >
                    <Icon icon="x" />
                  </Button>
                </div>
                <form
                  onSubmit={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    const formData = new FormData(event.currentTarget);
                    const link = formData.get('link');
                    if (typeof link === 'string') {
                      let parsedURL: URL;
                      try {
                        parsedURL = new URL(link);
                      } catch {
                        setError('Invalid URL');
                        return;
                      }

                      const code = parsedURL.searchParams.get('code');
                      const state = parsedURL.searchParams.get('state');

                      if (!(typeof code === 'string') || !(typeof state === 'string')) {
                        setError('Incomplete URL');
                        return;
                      }

                      completeSignInFetcher.submit({ provider: provider.type, code, state });
                    }
                  }}
                >
                  <label className="form-control form-control--outlined">
                    <div>If you aren't redirected to the app you can manually paste the authentication url here:</div>
                    <div className="flex justify-between gap-2">
                      <input name="link" />
                      <Button
                        type="submit"
                        name="add-token"
                        className="flex h-(--line-height-xs) items-center justify-center rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--color-surprise)/80"
                      >
                        Authenticate
                      </Button>
                    </div>
                  </label>
                  {error && (
                    <p className="notice error margin-bottom-sm">
                      <Button className="pull-right icon" onPress={() => setError('')}>
                        <Icon icon="times" className="size-4" />
                      </Button>
                      {error}
                    </p>
                  )}
                  {(initSignInError || completeSignInError) && (
                    <p className="margin-bottom-sm flex items-start gap-2 rounded-xs border border-solid border-(--color-danger) bg-(--color-danger-bg) p-2 text-(--color-danger)">
                      <Icon icon="exclamation-triangle" className="mt-1 size-4" />
                      <span>{initSignInError || completeSignInError}</span>
                    </p>
                  )}
                </form>
              </div>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </div>
  );
};
