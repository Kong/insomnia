import React, { useEffect, useState } from 'react';
import { Button } from 'react-aria-components';
import { useFetcher } from 'react-router';

import type { GitCredentials } from '../../../models/git-credentials';
import type { GitRepository } from '../../../models/git-repository';
import { showAlert } from '../modals';
import { GitHubRepositorySelect } from './github-repository-select';

interface Props {
  uri?: string;
  onSubmit: (args: Partial<GitRepository>) => void;
}

export const GitHubRepositorySetupFormGroup = (props: Props) => {
  const { onSubmit, uri } = props;
  const githubTokenLoader = useFetcher<GitCredentials>();

  useEffect(() => {
    if (!githubTokenLoader.data && githubTokenLoader.state === 'idle') {
      githubTokenLoader.load('/git-credentials/github');
    }
  }, [githubTokenLoader]);

  const credentials = githubTokenLoader.data;

  if (!credentials?.token) {
    return <GitHubSignInForm />;
  }

  return <GitHubRepositoryForm uri={uri} onSubmit={onSubmit} credentials={credentials} />;
};

const Avatar = ({ src }: { src: string }) => {
  const [imageSrc, setImageSrc] = useState('');

  useEffect(() => {
    const img = new Image();

    img.src = src;

    function onLoad() {
      setImageSrc(src);
    }

    function onError() {
      setImageSrc('');
    }

    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);

    return () => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
    };
  }, [src]);

  return imageSrc ? <img src={imageSrc} className="h-10 w-10 rounded-full" /> : <i className="fas fa-user-circle" />;
};

interface GitHubRepositoryFormProps {
  uri?: string;
  onSubmit: (args: Partial<GitRepository>) => void;
  credentials: GitCredentials;
}

const GitHubRepositoryForm = ({ uri, credentials, onSubmit }: GitHubRepositoryFormProps) => {
  const [error, setError] = useState('');
  const signOutFetcher = useFetcher();

  return (
    <form
      id="github"
      className="flex flex-col gap-6"
      onSubmit={event => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const uri = formData.get('uri') as string;
        if (!uri) {
          setError('Please select a repository');
          return;
        }
        onSubmit({
          uri,
          credentials: {
            oauth2format: 'github',
            password: '',
            token: '',
            username: '',
          },
        });
      }}
    >
      <div className="flex items-center justify-between rounded-sm border border-solid border-[--hl-sm] px-3 py-1">
        <div className="flex items-center gap-3">
          <Avatar src={credentials.author.avatarUrl ?? ''} />
          <div className="flex flex-col items-start">
            <span className="font-semibold">{credentials.author.name}</span>
            <span className="text-sm text-[--hl]">{credentials.author.email || 'Signed in'}</span>
          </div>
        </div>
        <Button
          type="button"
          onPress={() => {
            showAlert({
              title: 'Sign out of GitHub',
              message:
                'Are you sure you want to sign out? You will need to re-authenticate with GitHub to use this feature.',
              okLabel: 'Sign out',
              onConfirm: () => {
                signOutFetcher.submit({}, { action: '/git-credentials/github/sign-out', method: 'POST' });
              },
            });
          }}
        >
          Sign out
        </Button>
      </div>
      <GitHubRepositorySelect uri={uri} token={credentials.token} />
      {error && (
        <p className="notice error margin-bottom-sm">
          <button className="pull-right icon" onClick={() => setError('')}>
            <i className="fa fa-times" />
          </button>
          {error}
        </p>
      )}
    </form>
  );
};

const GitHubSignInForm = () => {
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const initSignInFetcher = useFetcher();
  const completeSignInFetcher = useFetcher();

  return (
    <div className="flex flex-col items-center justify-center border border-solid border-[--hl-sm] p-4">
      <Button
        className="flex items-center gap-2 disabled:opacity-100"
        type="button"
        isDisabled={isAuthenticating}
        onPress={() => {
          setIsAuthenticating(true);
          initSignInFetcher.submit({}, { action: '/git-credentials/github/init-sign-in', method: 'POST' });
        }}
      >
        <i className="fa fa-github" />
        {isAuthenticating ? 'Authenticating with GitHub App' : 'Authenticate with GitHub App'}
      </Button>

      {isAuthenticating && (
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
              } catch (error) {
                setError('Invalid URL');
                return;
              }

              const code = parsedURL.searchParams.get('code');
              const state = parsedURL.searchParams.get('state');

              if (!(typeof code === 'string') || !(typeof state === 'string')) {
                setError('Incomplete URL');
                return;
              }

              completeSignInFetcher.submit(
                { code, state },
                { action: '/git-credentials/github/complete-sign-in', method: 'POST', encType: 'application/json' },
              );
            }
          }}
        >
          <label className="form-control form-control--outlined">
            <div>If you aren't redirected to the app you can manually paste the authentication url here:</div>
            <div className="form-row">
              <input name="link" />
              <Button
                type="submit"
                name="add-token"
                className="flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid border-[--hl-md] bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] bg-opacity-100 px-4 py-2 text-sm font-semibold text-[--color-font-surprise] ring-1 ring-transparent transition-all hover:bg-opacity-80 focus:ring-inset focus:ring-[--hl-md] aria-pressed:opacity-80"
              >
                Authenticate
              </Button>
            </div>
          </label>
          {error && (
            <p className="notice error margin-bottom-sm">
              <Button className="pull-right icon" onPress={() => setError('')}>
                <i className="fa fa-times" />
              </Button>
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
};
