import React, { useEffect, useState } from 'react';
import { Button, FieldError, Form, Input, Label, TextField } from 'react-aria-components';

import type { GitCredentials } from '~/models/git-credentials';
import type { GitRepository } from '~/models/git-repository';
import { useGitLabCredentialsFetcher } from '~/routes/git-credentials.gitlab';
import { useGitLabCompleteSignInFetcher } from '~/routes/git-credentials.gitlab.complete-sign-in';
import { useInitSignInToGitLabFetcher } from '~/routes/git-credentials.gitlab.init-sign-in';
import { useGitLabSignOutFetcher } from '~/routes/git-credentials.gitlab.sign-out';
import { PromptButton } from '~/ui/components/base/prompt-button';
import { Icon } from '~/ui/components/icon';

import { GitRemoteBranchSelect } from './git-remote-branch-select';

interface Props {
  uri?: string;
  onSubmit: (args: Partial<GitRepository>) => void;
}

export const GitLabRepositorySetupFormGroup = (props: Props) => {
  const { onSubmit, uri } = props;
  const gitlabTokenLoader = useGitLabCredentialsFetcher();

  useEffect(() => {
    if (!gitlabTokenLoader.data && gitlabTokenLoader.state === 'idle') {
      gitlabTokenLoader.load();
    }
  }, [gitlabTokenLoader]);

  const credentials = gitlabTokenLoader.data;

  if (!credentials?.token) {
    return <GitLabSignInForm />;
  }

  return <GitLabRepositoryForm uri={uri} onSubmit={onSubmit} credentials={credentials} />;
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

interface GitLabRepositoryFormProps {
  uri?: string;
  onSubmit: (args: Partial<GitRepository>) => void;
  credentials: GitCredentials;
}

const GitLabRepositoryForm = ({ uri, credentials, onSubmit }: GitLabRepositoryFormProps) => {
  const [error, setError] = useState('');
  const [gitlabUri, setGitlabUri] = useState(uri || '');
  const signOutFetcher = useGitLabSignOutFetcher();
  const isReadOnly = Boolean(uri);
  return (
    <Form
      id="gitlab"
      className="flex flex-col gap-6"
      onSubmit={event => {
        event.preventDefault();
        onSubmit({
          uri: (new FormData(event.currentTarget).get('uri') as string) ?? '',
          author: {
            name: credentials.author.name,
            email: credentials.author.email,
          },
          credentials: {
            token: '',
            username: '',
            oauth2format: 'gitlab',
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
          onClick={() => {
            signOutFetcher.submit();
          }}
        >
          Disconnect
        </PromptButton>
      </div>
      <TextField
        autoFocus
        name="uri"
        type="url"
        pattern="https?://.*\.git"
        defaultValue={uri}
        onChange={value => setGitlabUri(value)}
        isReadOnly={isReadOnly}
        className="flex w-full flex-col gap-1 px-0.5"
        isRequired
      >
        <Label className="text-start text-sm font-semibold">Git URI (https, including .git suffix)</Label>
        <Input
          placeholder="https://gitlab.com/org/repo.git"
          className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:text-sm placeholder:italic focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
        />
        <FieldError className="text-xs text-(--color-danger)">
          {({ validationDetails, defaultChildren }) =>
            validationDetails.patternMismatch
              ? 'Please ensure the URL is valid and ends with a .git suffix.'
              : defaultChildren
          }
        </FieldError>
      </TextField>
      <GitRemoteBranchSelect
        credentials={{
          oauth2format: 'gitlab',
          token: '',
          password: '',
          username: '',
        }}
        url={gitlabUri || ''}
        isDisabled={Boolean(uri)}
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

const GitLabSignInForm = () => {
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const initSignInFetcher = useInitSignInToGitLabFetcher();
  const completeSignInFetcher = useGitLabCompleteSignInFetcher();

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
        <Icon icon={['fab', 'gitlab']} />
        {isAuthenticating ? 'Authenticating' : 'Authenticate'} with GitLab
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
            <div>If you aren't redirected to the app you can manually paste your code here:</div>
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
