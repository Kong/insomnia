import React, { type FunctionComponent } from 'react';
import { FieldError, Input, Label, TextField } from 'react-aria-components';

import { docsGitAccessToken } from '../../../common/documentation';
import type { GitRepository } from '../../../models/git-repository';
import { Link } from '../base/link';
import { HelpTooltip } from '../help-tooltip';
import { GitRemoteBranchSelect } from './git-remote-branch-select';

export interface Props {
  gitRepository?: Partial<GitRepository> | null;
  onSubmit: (args: Partial<GitRepository>) => void;
}

const isValidEmail = (email: string): boolean => {
  const emailRegex = new RegExp(
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
  );

  return emailRegex.test(email);
};

export const CustomRepositorySettingsFormGroup: FunctionComponent<Props> = ({ gitRepository, onSubmit }) => {
  const linkIcon = <i className="fa fa-external-link-square" />;

  const [state, setState] = React.useState({
    uri: gitRepository?.uri || '',
    credentials: {
      username: gitRepository?.credentials?.username || '',
      password:
        gitRepository?.credentials && 'password' in gitRepository.credentials ? gitRepository.credentials.password : '',
    },
    author: {
      name: gitRepository?.author?.name || '',
      email: gitRepository?.author?.email || '',
    },
  });

  const { uri, credentials, author } = state;

  const isFormDisabled = !state.uri;

  return (
    <form
      id="custom"
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault();
        onSubmit(state);
      }}
    >
      <TextField
        name="uri"
        className="flex w-full flex-col gap-1 px-0.5 text-sm"
        isRequired
        validate={value => {
          console.log({ value }, value.startsWith('http') && value.endsWith('.git'));
          return value.startsWith('http') && value.endsWith('.git')
            ? ''
            : 'Please enter a valid Git https URI (including .git suffix)';
        }}
      >
        <Label className="text-start text-sm font-semibold">Git URI (https, including .git suffix)</Label>
        <Input
          type="url"
          autoFocus
          value={uri}
          onChange={e => setState({ ...state, uri: e.currentTarget.value })}
          placeholder="https://github.com/org/repo.git"
          className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:text-sm placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
        />
        <FieldError className="text-xs text-[--color-danger]" />
      </TextField>
      <div className="flex items-center justify-between gap-2">
        <TextField name="authorName" className="flex w-full flex-col gap-1 px-0.5 text-sm" isRequired>
          <Label className={`text-start text-sm font-semibold ${isFormDisabled ? 'opacity-50' : ''}`}>
            Author Name
          </Label>
          <Input
            placeholder="Name"
            disabled={isFormDisabled}
            onChange={e => setState({ ...state, author: { ...author, name: e.currentTarget.value } })}
            value={author?.name}
            className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:text-sm placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
          />
        </TextField>
        <TextField
          name="authorEmail"
          className="flex w-full flex-col gap-1 px-0.5 text-sm"
          isRequired
          validate={value => (isValidEmail(value) ? '' : 'Please enter a valid email address')}
        >
          <Label className={`text-start text-sm font-semibold ${isFormDisabled ? 'opacity-50' : ''}`}>
            Author Email
          </Label>
          <Input
            placeholder="Email"
            disabled={isFormDisabled}
            onChange={e => setState({ ...state, author: { ...author, email: e.currentTarget.value } })}
            value={author?.email}
            className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:text-sm placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
          />
          <FieldError className="text-xs text-[--color-danger]" />
        </TextField>
      </div>
      <div className="flex items-center justify-between gap-2">
        <TextField name="username" className="flex w-full flex-col gap-1 px-0.5 text-sm" isRequired>
          <Label className={`text-start text-sm font-semibold ${isFormDisabled ? 'opacity-50' : ''}`}>Username</Label>
          <Input
            placeholder="MyUser"
            disabled={isFormDisabled}
            value={credentials?.username}
            onChange={e => setState({ ...state, credentials: { ...credentials, username: e.currentTarget.value } })}
            className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:text-sm placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
          />
        </TextField>
        <TextField name="token" className="flex w-full flex-col gap-1 px-0.5 text-sm" isRequired>
          <Label className={`text-start text-sm font-semibold ${isFormDisabled ? 'opacity-50' : ''}`}>
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
              <Link href={docsGitAccessToken.bitbucketServer}>Bitbucket Server {linkIcon}</Link>
              {' | '}
              <Link href={docsGitAccessToken.azureDevOps}>Azure DevOps {linkIcon}</Link>
            </HelpTooltip>
          </Label>
          <Input
            type="password"
            disabled={isFormDisabled}
            onChange={e => setState({ ...state, credentials: { ...credentials, password: e.currentTarget.value } })}
            value={'password' in credentials ? credentials?.password : ''}
            placeholder="88e7ee63b254e4b0bf047559eafe86ba9dd49507"
            className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:text-sm placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
          />
        </TextField>
      </div>
      <GitRemoteBranchSelect
        credentials={{
          password: credentials && 'password' in credentials ? credentials?.password : '',
          username: credentials?.username || '',
        }}
        url={uri || ''}
        isDisabled={isFormDisabled}
      />
    </form>
  );
};
