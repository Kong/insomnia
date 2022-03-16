import React, { FunctionComponent } from 'react';

import { docsGitAccessToken } from '../../../../common/documentation';
import { Link } from '../../base/link';
import { HelpTooltip } from '../../help-tooltip';

export interface Props {
  onInputChange: (e: React.SyntheticEvent<HTMLInputElement>) => void;
  isGitRepository: boolean;
  inputs: {
    uri?: string;
    authorName?: string;
    authorEmail?: string;
    username?: string;
    token?: string;
  };
}

export const CustomRepositorySettingsFormGroup: FunctionComponent<Props> = ({
  onInputChange,
  isGitRepository,
  inputs,
}) => {
  const linkIcon = <i className="fa fa-external-link-square" />;

  return (
    <div className='form-group'>
      <div className="form-control form-control--outlined">
        <label>
          Git URI (https)
          <input
            required
            autoFocus
            name="uri"
            defaultValue={inputs.uri}
            disabled={!!isGitRepository}
            onChange={onInputChange}
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
              defaultValue={inputs.authorName}
              onChange={onInputChange}
            />
          </label>
        </div>
        <div className="form-control form-control--outlined">
          <label>
            Author Email
            <input
              required
              type="email"
              name="authorEmail"
              placeholder="Email"
              defaultValue={inputs.authorEmail}
              onChange={onInputChange}
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
              defaultValue={inputs.username}
              onChange={onInputChange}
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
            </HelpTooltip>
            <input
              required
              type="password"
              name="token"
              defaultValue={inputs.token}
              onChange={onInputChange}
              placeholder="88e7ee63b254e4b0bf047559eafe86ba9dd49507"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
