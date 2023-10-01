import { AxiosResponse } from 'axios';
import type { GraphQLError } from 'graphql';
import React, { MouseEvent, useEffect, useState } from 'react';
import { useInterval, useLocalStorage } from 'react-use';
import styled from 'styled-components';

import { GitRepository } from '../../../../models/git-repository';
import {
  exchangeCodeForToken,
  generateAuthorizationUrl,
  GITHUB_GRAPHQL_API_URL,
  signOut,
} from '../../../../sync/git/github-oauth-provider';
import { Button } from '../../themed-button';
import { showAlert, showError } from '..';

interface Props {
  uri?: string;
  onSubmit: (args: Partial<GitRepository>) => void;
}

export const GitHubRepositorySetupFormGroup = (props: Props) => {
  const { onSubmit, uri } = props;

  const [githubToken, setGitHubToken] = useState(
    localStorage.getItem('github-oauth-token') || ''
  );

  useInterval(
    () => {
      const token = localStorage.getItem('github-oauth-token');

      if (token) {
        setGitHubToken(token);
      }
    },
    githubToken ? null : 500
  );

  if (!githubToken) {
    return <GitHubSignInForm />;
  }

  return (
    <GitHubRepositoryForm
      uri={uri}
      onSubmit={onSubmit}
      token={githubToken}
      onSignOut={() => {
        setGitHubToken('');
        signOut();
      }}
    />
  );
};

interface FetchGraphQLInput {
  query: string;
  variables?: Record<string, any>;
  headers: Record<string, any>;
  url: string;
}

async function fetchGraphQL<QueryResult>(input: FetchGraphQLInput) {
  const { headers, query, variables, url } = input;
  const response: AxiosResponse<{ data: QueryResult; errors: GraphQLError[] }> =
    await window.main.axiosRequest({
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      data: {
        query,
        variables,
      },
    });

  return response.data;
}

const GitHubUserInfoQuery = `
  query getUserInfo {
    viewer {
      login
      email
      avatarUrl
      url
    }
  }
`;

interface GitHubUserInfoQueryResult {
  viewer: {
    login: string;
    email: string;
    avatarUrl: string;
    url: string;
  };
}

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

interface GitHubRepositoryFormProps {
  uri?: string;
  onSubmit: (args: Partial<GitRepository>) => void;
  onSignOut: () => void;
  token?: string;
}

const GitHubRepositoryForm = ({
  uri,
  token,
  onSubmit,
  onSignOut,
}: GitHubRepositoryFormProps) => {
  const [error, setError] = useState('');

  const [user, setUser, removeUser] = useLocalStorage<GitHubUserInfoQueryResult['viewer']>(
    'github-user-info',
    undefined
  );

  const handleSignOut = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    showAlert({
      title: 'Sign out of GitHub',
      message:
        'Are you sure you want to sign out? You will need to re-authenticate with GitHub to use this feature.',
      okLabel: 'Sign out',
      onConfirm: () => {
        removeUser();
        onSignOut();
      },
    });
  };

  useEffect(() => {
    let isMounted = true;

    if (token && !user) {
      fetchGraphQL<GitHubUserInfoQueryResult>({
        query: GitHubUserInfoQuery,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        url: GITHUB_GRAPHQL_API_URL,
      })
        .then(({ data, errors }) => {
          if (isMounted) {
            if (errors) {
              setError(
                'Something went wrong when trying to fetch info from GitHub.'
              );
            } else if (data) {
              setUser(data.viewer);
            }
          }
        })
        .catch((error: unknown) => {
          if (error instanceof Error) {
            setError(
              'Something went wrong when trying to fetch info from GitHub.'
            );
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [token, onSubmit, setUser, user]);

  return (
    <form
      id="github"
      className="form-group"
      style={{ height: '100%' }}
      onSubmit={event => {
        event.preventDefault();
        onSubmit({
          uri: (new FormData(event.currentTarget).get('uri') as string) ?? '',
          author: {
            name: user?.login ?? '',
            email: user?.email ?? '',
          },
          credentials: {
            username: token ?? '',
            token: token ?? '',
            oauth2format: 'github',
          },
        });
      }}
    >
      {token && (
        <div className="form-control form-control--outlined">
          <label>
            GitHub URI (https, including .git suffix)
            <input
              className="form-control"
              defaultValue={uri}
              type="url"
              name="uri"
              autoFocus
              required
              disabled={Boolean(uri)}
              placeholder="https://github.com/org/repo.git"
            />
          </label>
        </div>
      )}
      <AccountViewContainer>
        <AccountDetails>
          <Avatar src={user?.avatarUrl ?? ''} />
          <Details>
            <span
              style={{
                fontSize: 'var(--font-size-lg)',
              }}
            >
              {user?.login}
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-md)',
              }}
            >
              {user?.email}
            </span>
          </Details>
        </AccountDetails>
        <Button type="button" onClick={handleSignOut}>
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

interface GitHubSignInFormProps {
  token?: string;
}

const GitHubSignInForm = ({ token }: GitHubSignInFormProps) => {
  const [error, setError] = useState('');
  const [authUrl, setAuthUrl] = useState(() => generateAuthorizationUrl());
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // When we get a new token we reset the authenticating flag and auth url. This happens because we can use the generated url for only one authorization flow.
  useEffect(() => {
    if (token) {
      setIsAuthenticating(false);
      setAuthUrl(generateAuthorizationUrl());
    }
  }, [token]);

  return (
    <AuthorizationFormContainer>
      <a
        href={authUrl}
        onClick={() => {
          setIsAuthenticating(true);
        }}
      >
        <i className="fa fa-github" />
        {isAuthenticating ? 'Authenticating' : 'Authenticate'} with GitHub
      </a>

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

              exchangeCodeForToken({
                code,
                state,
              }).catch((error: Error) => {
                showError({
                  error,
                  title: 'Error authorizing GitHub',
                  message: error.message,
                });
              });
            }
          }}
        >
          <label className="form-control form-control--outlined">
            <div>
              If you aren't redirected to the app you can manually paste the authentication url here:
            </div>
            <div className="form-row">
              <input name="link" />
              <Button bg="surprise" name="add-token">Authenticate</Button>
            </div>
          </label>
          {error && (
            <p className="notice error margin-bottom-sm">
              <button className="pull-right icon" onClick={() => setError('')}>
                <i className="fa fa-times" />
              </button>
              {error}
            </p>
          )}
        </form>
      )}
    </AuthorizationFormContainer>
  );
};
