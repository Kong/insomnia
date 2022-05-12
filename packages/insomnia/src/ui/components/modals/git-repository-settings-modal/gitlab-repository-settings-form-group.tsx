import { AxiosResponse } from 'axios';
import type { GraphQLError } from 'graphql';
import { Button } from 'insomnia-components';
import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useInterval, useLocalStorage } from 'react-use';
import styled from 'styled-components';

import { getGitLabOauthApiURL } from '../../../../common/constants';
import { GitRepository } from '../../../../models/git-repository';
import { axiosRequest } from '../../../../network/axios-request';
import {
  generateAuthorizationUrl,
  signOut,
} from '../../../../sync/git/gitlab-oauth-provider';
import {
  COMMAND_GITLAB_OAUTH_AUTHENTICATE,
  newCommand,
} from '../../../redux/modules/global';
import { showAlert } from '..';

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

  if (!gitlabToken) {
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

const GitLabUserInfoQuery = `
  query getUserInfo {
    currentUser {
      publicEmail
      name
      avatarUrl
    }
  }
`;

interface GitLabUserInfoQueryResult {
  currentUser: {
    publicEmail: string;
    name: string;
    avatarUrl: string;
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

  const [user, setUser] = useLocalStorage<GitLabUserInfoQueryResult['currentUser']>(
    'gitlab-user-info',
    undefined
  );

  useEffect(() => {
    let isMounted = true;

    if (token && !user) {
      fetchGraphQL<GitLabUserInfoQueryResult>({
        query: GitLabUserInfoQuery,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        url: `${getGitLabOauthApiURL()}/api/graphql`,
      })
        .then(({ data, errors }) => {
          if (isMounted) {
            if (errors) {
              setError(
                'Something went wrong when trying to fetch info from GitLab.'
              );
            } else if (data) {
              setUser(data.currentUser);
            }
          }
        })
        .catch((e: unknown) => {
          if (e instanceof Error) {
            setError(
              'Something went wrong when trying to fetch info from GitLab.'
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
      id="gitlab"
      className="form-group"
      style={{ height: '100%' }}
      onSubmit={e =>
        onSubmit({
          uri: (new FormData(e.currentTarget).get('uri') as string) ?? '',
          author: {
            name: user?.name ?? '',
            email: user?.publicEmail ?? '',
          },
          credentials: {
            username: token ?? '',
            token: token ?? '',
            oauth2format: 'gitlab',
          },
        })
      }
    >
      {token && (
        <div className="form-control form-control--outlined">
          <label>
            GitLab URI
            <input
              className="form-control"
              defaultValue={uri}
              type="url"
              name="uri"
              autoFocus
              required
              placeholder="https://gitlab.com/org/repo.git"
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
              {user?.name}
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-md)',
              }}
            >
              {user?.publicEmail}
            </span>
          </Details>
        </AccountDetails>
        <Button
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            showAlert({
              title: 'Sign out of GitLab',
              message:
                'Are you sure you want to sign out? You will need to re-authenticate with GitLab to use this feature.',
              okLabel: 'Sign out',
              onConfirm: () => {
                setUser(undefined);
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
  const [authUrl, setAuthUrl] = useState(() => generateAuthorizationUrl());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const dispatch = useDispatch();

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
        <i className="fa fa-gitlab" />
        {isAuthenticating ? 'Authenticating' : 'Authenticate'} with GitLab
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
                const command = newCommand(COMMAND_GITLAB_OAUTH_AUTHENTICATE, {
                  code,
                  state,
                });

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
};
