import { AxiosResponse } from 'axios';
import type { GraphQLError } from 'graphql';
import { Button } from 'insomnia-components';
import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useInterval, useLocalStorage } from 'react-use';
import styled from 'styled-components';

import { axiosRequest } from '../../../../network/axios-request';
import {
  generateAuthorizationUrl,
  GITHUB_GRAPHQL_API_URL,
  signOut,
} from '../../../../sync/git/github-oauth-provider';
import {
  COMMAND_GITHUB_OAUTH_AUTHENTICATE,
  newCommand,
} from '../../../redux/modules/global';
import { showAlert } from '..';

interface FetchGraphQLInput {
  query: string;
  variables?: Record<string, any>;
  headers: Record<string, any>;
  url: string;
}

async function fetchGraphQL<QueryResult>(input: FetchGraphQLInput) {
  const { headers, query, variables, url } = input;
  const response: AxiosResponse<{ data: QueryResult; errors: GraphQLError[] }> =
    await axiosRequest({
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
  });

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

const GitHubAccountView = (props: {
  user?: GitHubUserInfoQueryResult['viewer'];
  onSignOut: () => void;
  token?: string;
}) => {
  const { user, onSignOut, token } = props;
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authUrl, setAuthUrl] = useState(() => generateAuthorizationUrl());

  const dispatch = useDispatch();

  // When we get a new token we reset the authenticating flag and auth url. This happens because we can use the generated url for only one authorization flow.
  useEffect(() => {
    if (token) {
      setIsAuthenticating(false);
      setAuthUrl(generateAuthorizationUrl());
    }
  }, [token]);

  if (!token) {
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
            onSubmit={e => {
              e.preventDefault();
              e.stopPropagation();
              const formData = new FormData(e.currentTarget);
              const link = formData.get('link');
              if (typeof link === 'string') {
                const parsedURL = new URL(link);
                const code = parsedURL.searchParams.get('code');
                const state = parsedURL.searchParams.get('state');

                if (typeof code === 'string' && typeof state === 'string') {
                  const command = newCommand(
                    COMMAND_GITHUB_OAUTH_AUTHENTICATE,
                    {
                      code,
                      state,
                    }
                  );

                  command(dispatch);
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
                <Button name="add-token">Add</Button>
              </div>
            </label>
          </form>
        )}
      </AuthorizationFormContainer>
    );
  }

  return (
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
      <Button
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          showAlert({
            title: 'Sign out of GitHub',
            message:
              'Are you sure you want to sign out? You will need to re-authenticate with GitHub to use this feature.',
            okLabel: 'Sign out',
            onConfirm: () => {
              onSignOut();
              signOut();
            },
          });
        }}
      >
        Sign out
      </Button>
    </AccountViewContainer>
  );
};

interface Props {
  uri: string;
  onChange: (args: {
    uri: string;
    author: { name: string; email: string };
    token: string;
  }) => void;
}

export const GitHubRepositorySetupFormGroup = (props: Props) => {
  const { onChange, uri } = props;

  const [user, setUser] = useLocalStorage<GitHubUserInfoQueryResult['viewer']>(
    'github-user-info',
    undefined
  );

  const [githubToken, setGitHubToken] = useState(
    localStorage.getItem('github-oauth-token') || ''
  );

  const [error, setError] = useState('');

  useInterval(
    () => {
      const token = localStorage.getItem('github-oauth-token');

      if (token) {
        setGitHubToken(token);
      }
    },
    githubToken ? null : 500
  );

  useEffect(() => {
    let isMounted = true;

    if (githubToken && !user) {
      fetchGraphQL<GitHubUserInfoQueryResult>({
        query: GitHubUserInfoQuery,
        headers: {
          Authorization: `Bearer ${githubToken}`,
        },
        url: GITHUB_GRAPHQL_API_URL,
      })
        .then(({ data, errors }) => {
          if (isMounted) {
            if (errors) {
              setError('Something went wrong when trying to fetch info from GitHub.');
            } else if (data) {
              setUser(data.viewer);
            }
          }
        })
        .catch((e: unknown) => {
          if (e instanceof Error) {
            setError(
              'Something went wrong when trying to fetch info from GitHub.'
            );
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [githubToken, onChange, setUser, user]);

  return (
    <div className="form-group" style={{ height: '100%' }}>
      {githubToken && (
        <div className="form-control form-control--outlined">
          <label>
            GitHub URI
            <input
              className="form-control"
              defaultValue={uri}
              type="url"
              name="uri"
              autoFocus
              placeholder="https://github.com/org/repo.git"
              onChange={e => {
                onChange({
                  uri: e.target.value,
                  author: {
                    name: user?.login ?? '',
                    email: user?.email ?? '',
                  },
                  token: githubToken,
                });
              }}
            />
          </label>
        </div>
      )}
      <GitHubAccountView
        user={user}
        token={githubToken}
        onSignOut={() => {
          setGitHubToken('');
          setUser(undefined);
        }}
      />
      {error && (
        <p className="notice error margin-bottom-sm">
          <button className="pull-right icon" onClick={() => setError('')}>
            <i className="fa fa-times" />
          </button>
          {error}
        </p>
      )}
    </div>
  );
};
