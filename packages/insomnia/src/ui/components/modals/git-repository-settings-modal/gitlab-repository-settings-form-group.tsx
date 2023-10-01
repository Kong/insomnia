import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useInterval, useLocalStorage } from 'react-use';
import styled from 'styled-components';

import { GitRepository } from '../../../../models/git-repository';
import {
  exchangeCodeForGitLabToken,
  generateAuthorizationUrl,
  getGitLabOauthApiURL,
  refreshToken,
  signOut,
} from '../../../../sync/git/gitlab-oauth-provider';
import { Button } from '../../themed-button';
import { showAlert, showError } from '..';

interface Props {
  uri?: string;
  onSubmit: (args: Partial<GitRepository>) => void;
}

export const GitLabRepositorySetupFormGroup = (props: Props) => {
  const { onSubmit, uri } = props;

  const [gitlabToken, setGitLabToken] = useState(
    localStorage.getItem('gitlab-oauth-token') || ''
  );

  useInterval(
    () => {
      const token = localStorage.getItem('gitlab-oauth-token');

      if (token) {
        setGitLabToken(token);
      }
    },
    gitlabToken ? null : 500
  );

  if (typeof gitlabToken !== 'string' || !gitlabToken) {
    return <GitLabSignInForm />;
  }

  return (
    <GitLabRepositoryForm
      uri={uri}
      onSubmit={onSubmit}
      token={gitlabToken}
      onSignOut={() => {
        setGitLabToken('');
        signOut();
      }}
    />
  );
};

const AccountViewContainer = styled.div({
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'space-between',
  border: '1px solid var(--hl-sm)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--padding-sm)',
  boxSizing: 'border-box',
});

const AccountDetails = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--padding-sm)',
});

const AvatarImg = styled.img({
  borderRadius: 'var(--radius-md)',
  width: 16,
  height: 16,
});

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
    <AvatarImg src={imageSrc} />
  ) : (
    <i className="fas fa-user-circle" />
  );
};

const Details = styled.div({
  display: 'flex',
  flexDirection: 'column',
});

const AuthorizationFormContainer = styled.div({
  display: 'flex',
  placeContent: 'center',
  placeItems: 'center',
  flexDirection: 'column',
  height: '100%',
  border: '1px solid var(--hl-sm)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--padding-sm)',
  boxSizing: 'border-box',
});

export interface GitLabUserResult {
  id: number;
  username: string;
  name: string;
  avatar_url: string;
  public_email: string;
  email: string;
  projects_limit: number;
  commit_email: string;
}

interface GitLabRepositoryFormProps {
  uri?: string;
  onSubmit: (args: Partial<GitRepository>) => void;
  onSignOut: () => void;
  token?: string;
}

const GitLabRepositoryForm = ({
  uri,
  token,
  onSubmit,
  onSignOut,
}: GitLabRepositoryFormProps) => {
  const [error, setError] = useState('');

  const [user, setUser, removeUser] = useLocalStorage<GitLabUserResult>(
    'gitlab-user-info',
    undefined
  );

  useEffect(() => {
    if (token && !user) {
      window.main.axiosRequest({
        method: 'GET',
        url: `${getGitLabOauthApiURL()}/api/v4/user`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).then(({ data }) => {
        setUser(data);
      })
        .catch((error: unknown) => {
          if (axios.isAxiosError(error) && error.response?.status === 401) {
            refreshToken();
          } else {
            const errorMessage = (error instanceof Error) ? error.message : 'Something went wrong when trying to fetch info from GitLab.';
            setError(errorMessage);
            console.log(`[gitlab oauth]: ${error}`);
          }
        });
    }
  }, [token, onSubmit, setUser, user]);

  return (
    <form
      id="gitlab"
      className="form-group"
      style={{ height: '100%' }}
      onSubmit={event => {
        event.preventDefault();
        onSubmit({
          uri: (new FormData(event.currentTarget).get('uri') as string) ?? '',
          author: {
            name: (user?.username || user?.name) ?? '',
            email: user?.commit_email ?? user?.public_email ?? user?.email ?? '',
          },
          credentials: {
            username: token ?? '',
            token: token ?? '',
            oauth2format: 'gitlab',
          },
        });
      }
      }
    >
      {token && (
        <div className="form-control form-control--outlined">
          <label>
            GitLab URI (https, including .git suffix)
            <input
              className="form-control"
              defaultValue={uri}
              type="url"
              name="uri"
              autoFocus
              disabled={Boolean(uri)}
              required
              placeholder="https://gitlab.com/org/repo.git"
            />
          </label>
        </div>
      )}
      <AccountViewContainer>
        <AccountDetails>
          <Avatar src={user?.avatar_url ?? ''} />
          <Details>
            <span
              style={{
                fontSize: 'var(--font-size-lg)',
              }}
            >
              {user?.name}
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-md)',
              }}
            >
              {user?.commit_email ?? user?.public_email ?? user?.email}
            </span>
          </Details>
        </AccountDetails>
        <Button
          type="button"
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            showAlert({
              title: 'Sign out of GitLab',
              message:
                'Are you sure you want to sign out? You will need to re-authenticate with GitLab to use this feature.',
              okLabel: 'Sign out',
              onConfirm: () => {
                removeUser();
                onSignOut();
              },
            });
          }}
        >
          Sign out
        </Button>
      </AccountViewContainer>

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

interface GitLabSignInFormProps {
  token?: string;
}

const GitLabSignInForm = ({ token }: GitLabSignInFormProps) => {
  const [authUrl, setAuthUrl] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // When we get a new token we reset the authenticating flag and auth url. This happens because we can use the generated url for only one authorization flow.
  useEffect(() => {
    if (token) {
      setIsAuthenticating(false);

      generateAuthorizationUrl().then(setAuthUrl);
    }
  }, [token]);

  useEffect(() => {
    if (!authUrl) {
      generateAuthorizationUrl().then(setAuthUrl);
    }
  }, [authUrl]);

  return !authUrl ? (<div />) : (
    <AuthorizationFormContainer>
      <a
        href={authUrl}
        onClick={() => {
          setIsAuthenticating(true);
        }}
      >
        <i className="fa fa-gitlab" />
        {isAuthenticating ? 'Authenticating' : 'Authenticate'} with GitLab
      </a>

      {isAuthenticating && (
        <form
          onSubmit={event => {
            event.preventDefault();
            event.stopPropagation();
            const formData = new FormData(event.currentTarget);
            const link = formData.get('link');
            if (typeof link === 'string') {
              const parsedURL = new URL(link);
              const code = parsedURL.searchParams.get('code');
              const state = parsedURL.searchParams.get('state');

              if (typeof code === 'string' && typeof state === 'string') {
                exchangeCodeForGitLabToken({
                  code,
                  state,
                }).catch((error: Error) => {
                  showError({
                    error,
                    title: 'Error authorizing GitLab',
                    message: error.message,
                  });
                });
              }
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
              <Button bg="surprise" name="add-token">Authenticate</Button>
            </div>
          </label>
        </form>
      )}
    </AuthorizationFormContainer>
  );
};
