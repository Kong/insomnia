import React, { useEffect, useState } from 'react';
import { Button, Form } from 'react-aria-components';

import type { GitCredentials } from '~/models/git-credentials';
import type { GitRepository } from '~/models/git-repository';
import { useGitHubCredentialsFetcher } from '~/routes/git-credentials.github';
import { useGithubCompleteSignInFetcher } from '~/routes/git-credentials.github.complete-sign-in';
import { useInitSignInToGitHubFetcher } from '~/routes/git-credentials.github.init-sign-in';
import { useGithubSignOutFetcher } from '~/routes/git-credentials.github.sign-out';
import { PromptButton } from '~/ui/components/base/prompt-button';
import { Icon } from '~/ui/components/icon';

import { GitHubRepositorySelect } from './github-repository-select';

interface Props {
  uri?: string;
  onSubmit: (args: Partial<GitRepository>) => void;
  allConnectedRepoURIProjectNameMap?: Record<string, string> | undefined;
}

export const GitHubRepositorySetupFormGroup = (props: Props) => {
  const { onSubmit, uri, allConnectedRepoURIProjectNameMap } = props;
  const githubTokenLoader = useGitHubCredentialsFetcher();

  useEffect(() => {
    if (!githubTokenLoader.data && githubTokenLoader.state === 'idle') {
      githubTokenLoader.load();
    }
  }, [githubTokenLoader]);

  const credentials = githubTokenLoader.data?.credentials;

  if (!credentials?.token) {
    return <GitHubSignInForm />;
  }

  return (
    <GitHubRepositoryForm
      uri={uri}
      onSubmit={onSubmit}
      credentials={credentials}
      allConnectedRepoURIProjectNameMap={allConnectedRepoURIProjectNameMap}
    />
  );
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
  onSubmit: (args: Partial<GitRepository & { ref?: string }>) => void;
  credentials: GitCredentials;
  allConnectedRepoURIProjectNameMap?: Record<string, string> | undefined;
}

const GitHubRepositoryForm = ({
  uri,
  credentials,
  onSubmit,
  allConnectedRepoURIProjectNameMap,
}: GitHubRepositoryFormProps) => {
  const [error, setError] = useState('');
  const signOutFetcher = useGithubSignOutFetcher();

  return (
    <Form
      id="github"
      className="flex flex-col gap-6"
      onSubmit={event => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const uri = formData.get('uri') as string;
        const ref = formData.get('branch') as string;
        if (!uri) {
          setError('Please select a repository');
          return;
        }
        onSubmit({
          uri,
          ref,
          credentials: {
            oauth2format: 'github',
            password: '',
            token: '',
            username: '',
          },
        });
      }}
    >
      <div className="flex items-center justify-between rounded-xs border border-solid border-(--hl-sm) px-3 py-1">
        <div className="flex items-center gap-3">
          <Avatar src={credentials.author.avatarUrl ?? ''} />
          <div className="flex flex-col items-start">
            <span className="font-semibold">{credentials.author.name}</span>
            <span className="text-sm text-(--hl)">{credentials.author.email || 'Signed in'}</span>
          </div>
        </div>
        <PromptButton
          confirmMessage="Confirm"
          onClick={e => {
            e.preventDefault();
            signOutFetcher.submit();
          }}
        >
          Disconnect
        </PromptButton>
      </div>
      <GitHubRepositorySelect
        uri={uri}
        token={credentials.token}
        allConnectedRepoURIProjectNameMap={allConnectedRepoURIProjectNameMap}
      />
      {error && (
        <p className="notice error margin-bottom-sm">
          <button className="pull-right icon" onClick={() => setError('')}>
            <i className="fa fa-times" />
          </button>
          {error}
        </p>
      )}
    </Form>
  );
};
const getErrorResult = (data: any) => {
  if (data && 'errors' in data && Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.join(', ');
  }
  return null;
};
const GitHubSignInForm = () => {
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const initSignInFetcher = useInitSignInToGitHubFetcher();
  const completeSignInFetcher = useGithubCompleteSignInFetcher();

  const initSignInError = getErrorResult(initSignInFetcher.data);
  const completeSignInError = getErrorResult(completeSignInFetcher.data);

  return (
    <div className="flex flex-col items-center justify-center border border-solid border-(--hl-sm) p-4">
      <Button
        className="flex items-center gap-2 disabled:opacity-100"
        type="button"
        isDisabled={isAuthenticating}
        onPress={() => {
          setIsAuthenticating(true);
          initSignInFetcher.submit();
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

              completeSignInFetcher.submit({ code, state });
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
                className="flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--color-surprise)/80"
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
            <p className="margin-bottom-sm flex items-center rounded-xs border border-solid border-(--color-danger) bg-(--color-danger-bg) p-2 text-(--color-danger)">
              <Icon icon="exclamation-triangle" className="size-4" />
              <span>{initSignInError || completeSignInError}</span>
            </p>
          )}
        </form>
      )}
    </div>
  );
};
