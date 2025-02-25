import React, { type FunctionComponent } from 'react';

import { docsGitAccessToken } from '../../../../common/documentation';
import type { GitRepository } from '../../../../models/git-repository';
import { Link } from '../../base/link';
import { HelpTooltip } from '../../help-tooltip';

export interface Props {
  gitRepository?: Partial<GitRepository> | null;
  onSubmit: (args: Partial<GitRepository>) => void;
}

export const CustomRepositorySettingsFormGroup: FunctionComponent<Props> = ({
  gitRepository,
  onSubmit,
}) => {
  const linkIcon = <i className="fa fa-external-link-square" />;
  const defaultValues = gitRepository || { uri: '', credentials: { username: '', token: '' }, author: { name: '', email: '' } };

  const uri = defaultValues.uri;
  const author = defaultValues.author;
  const credentials = defaultValues?.credentials || { username: '', token: '' };

  return (
    <form
      id="custom"
      className='form-group'
      onSubmit={event => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        onSubmit({
          uri: formData.get('uri') as string || '',
          credentials: {
            username: formData.get('username') as string || '',
            token: formData.get('token') as string || '',
          },
          author: {
            name: formData.get('authorName') as string || '',
            email: formData.get('authorEmail') as string || '',
          },
        });
      }}
    >
      <div className="form-control form-control--outlined">
        <label>
          Git URI (https, including .git suffix)
          <input
            type="url"
            required
            autoFocus
            name="uri"
            defaultValue={uri}
            disabled={Boolean(uri)}
            placeholder="https://github.com/org/repo.git"
          />
        </label>
      </div>
      <div className="form-row">
        <div className="form-control form-control--outlined">
          <label>
            Author Name
            <input
              required
              type="text"
              name="authorName"
              placeholder="Name"
              disabled={Boolean(uri)}
              defaultValue={author?.name}
            />
          </label>
        </div>
        <div className="form-control form-control--outlined">
          <label>
            Author Email
            <input
              required
              type="text"
              name="authorEmail"
              placeholder="Email"
              disabled={Boolean(uri)}
              defaultValue={author?.email}
            />
          </label>
        </div>
      </div>
      <div className="form-row">
        <div className="form-control form-control--outlined">
          <label>
            Username
            <input
              required
              type="text"
              name="username"
              placeholder="MyUser"
              disabled={Boolean(uri)}
              defaultValue={credentials?.username}
            />
          </label>
        </div>
        <div className="form-control form-control--outlined">
          <label>
            Authentication Token
            <HelpTooltip className="space-left">
              Create a personal access token
              <br />
              <Link href={docsGitAccessToken.github}>GitHub {linkIcon}</Link>
              {' | '}
              <Link href={docsGitAccessToken.gitlab}>GitLab {linkIcon}</Link>
              {' | '}
              <Link href={docsGitAccessToken.bitbucket}>Bitbucket {linkIcon}</Link>
              {' | '}
              <Link href={docsGitAccessToken.bitbucketServer}>
                Bitbucket Server {linkIcon}
              </Link>
              {' | '}
              <Link href={docsGitAccessToken.azureDevOps}>
                Azure DevOps {linkIcon}
              </Link>
            </HelpTooltip>
            <input
              required
              type="password"
              name="token"
              disabled={Boolean(uri)}
              defaultValue={'token' in credentials ? credentials?.token : ''}
              placeholder="88e7ee63b254e4b0bf047559eafe86ba9dd49507"
            />
          </label>
        </div>
      </div>
    </form>
  );
};
