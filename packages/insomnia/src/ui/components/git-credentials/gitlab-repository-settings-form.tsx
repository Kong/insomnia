import React, { useEffect, useState } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';
import { useFetcher } from 'react-router-dom';

import type { GitCredentials } from '../../../models/git-credentials';
import type { GitRepository } from '../../../models/git-repository';
import { Icon } from '../icon';
import { showAlert } from '../modals';

interface Props {
  uri?: string;
  onSubmit: (args: Partial<GitRepository>) => void;
}

export const GitLabRepositorySetupFormGroup = (props: Props) => {
  const { onSubmit, uri } = props;
  const gitlabTokenLoader = useFetcher<GitCredentials>();

  useEffect(() => {
    if (!gitlabTokenLoader.data && gitlabTokenLoader.state === 'idle') {
      gitlabTokenLoader.load('/git-credentials/gitlab');
    }
  }, [gitlabTokenLoader]);

  const credentials = gitlabTokenLoader.data;

  if (!credentials?.token) {
    return <GitLabSignInForm />;
  }

  return (
    <GitLabRepositoryForm
      uri={uri}
      onSubmit={onSubmit}
      credentials={credentials}
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

  return imageSrc ? (
    <img src={imageSrc} className="rounded-full w-10 h-10" />
  ) : (
    <i className="fas fa-user-circle" />
  );
};

interface GitLabRepositoryFormProps {
  uri?: string;
  onSubmit: (args: Partial<GitRepository>) => void;
  credentials: GitCredentials;
}

const GitLabRepositoryForm = ({
  uri,
  credentials,
  onSubmit,
}: GitLabRepositoryFormProps) => {
  const [error, setError] = useState('');

  const signOutFetcher = useFetcher();

  return (
    <form
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
      <div className='flex items-center justify-between border border-solid border-[--hl-sm] rounded-sm py-1 px-3'>
        <div className="flex gap-3 items-center">
          <Avatar src={credentials.author.avatarUrl ?? ''} />
          <div className='flex flex-col items-start'>
            <span className='font-semibold'>
              {credentials.author.name}
            </span>
            <span className='text-sm text-[--hl]'>
              {credentials.author.email || 'Signed in'}
            </span>
          </div>
        </div>
        <Button
          type="button"
          onPress={() => {
            showAlert({
              title: 'Sign out of GitLab',
              message:
                'Are you sure you want to sign out? You will need to re-authenticate with GitLab to use this feature.',
              okLabel: 'Sign out',
              onConfirm: () => {
                signOutFetcher.submit({}, { action: '/git-credentials/gitlab/sign-out', method: 'POST' });
              },
            });
          }}
        >
          Sign out
        </Button>
      </div>
      <TextField autoFocus name="uri" className="flex flex-col w-full gap-1 px-0.5" isRequired>
        <Label className='text-start text-sm font-semibold'>Git URI (https, including .git suffix)</Label>
        <Input
          type="url"
          defaultValue={uri}
          disabled={Boolean(uri)}
          placeholder="https://github.com/org/repo.git"
          className="py-1 placeholder:italic w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors placeholder:text-sm"
        />
      </TextField>
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

const GitLabSignInForm = () => {
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const initSignInFetcher = useFetcher();
  const completeSignInFetcher = useFetcher();

  return (
    <div
      className='flex items-center justify-center flex-col border border-solid border-[--hl-sm] p-4'
    >
      <Button
        className="flex items-center gap-2 disabled:opacity-100"
        type="button"
        isDisabled={isAuthenticating}
        onPress={() => {
          setIsAuthenticating(true);
          initSignInFetcher.submit({}, { action: '/git-credentials/gitlab/init-sign-in', method: 'POST' });
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

              completeSignInFetcher.submit({ code, state }, { action: '/git-credentials/gitlab/complete-sign-in', method: 'POST', encType: 'application/json' });
            }
          }}
        >
          <label className="form-control form-control--outlined">
            <div>
              If you aren't redirected to the app you can manually paste your
              code here:
            </div>
            <div className="form-row">
              <input name="link" />
              <Button type="submit" name="add-token" className="w-[10ch] text-[--color-font-surprise] font-semibold border border-solid border-[--hl-md] bg-opacity-100 bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] px-4 py-2 h-full flex items-center justify-center gap-2 aria-pressed:opacity-80 rounded-md hover:bg-opacity-80 focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">Authenticate</Button>
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
