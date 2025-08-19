import React, { type FunctionComponent } from 'react';
import { Input, Label, TextField } from 'react-aria-components';

import { docsGitAccessToken } from '../../../common/documentation';
import type { GitRepository } from '../../../models/git-repository';
import { Link } from '../base/link';
import { HelpTooltip } from '../help-tooltip';
import { GitRemoteBranchSelect } from './git-remote-branch-select';

export interface Props {
  gitRepository?: Partial<GitRepository> | null;
  onSubmit: (args: Partial<GitRepository>) => void;
}

export const CustomRepositorySettingsFormGroup: FunctionComponent<Props> = ({ gitRepository, onSubmit }) => {
  const linkIcon = <i className="fa fa-external-link-square" />;
  const defaultValues = gitRepository || {
    uri: '',
    credentials: { username: '', password: '' },
    author: { name: '', email: '' },
  };

  const [credentials, setCredentials] = React.useState({
    username: defaultValues.credentials?.username || '',
    password:
      defaultValues.credentials && 'password' in defaultValues.credentials ? defaultValues.credentials.password : '',
  });

  const [uri, setUri] = React.useState(defaultValues.uri || '');

  const author = defaultValues.author;

  return (
    <form
      id="custom"
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        onSubmit({
          uri: (formData.get('uri') as string) || '',
          credentials: {
            username: (formData.get('username') as string) || '',
            token: (formData.get('token') as string) || '',
          },
          author: {
            name: (formData.get('authorName') as string) || '',
            email: (formData.get('authorEmail') as string) || '',
          },
        });
      }}
    >
      <TextField name="uri" className="flex w-full flex-col gap-1 px-0.5" isRequired>
        <Label className="text-start text-sm font-semibold">Git URI (https, including .git suffix)</Label>
        <Input
          type="url"
          autoFocus
          defaultValue={uri}
          onChange={e => setUri(e.currentTarget.value)}
          disabled={Boolean(defaultValues.uri)}
          placeholder="https://github.com/org/repo.git"
          className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:text-sm placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
        />
      </TextField>
      <div className="flex items-center justify-between gap-2">
        <TextField name="authorName" className="flex w-full flex-col gap-1 px-0.5" isRequired>
          <Label className="text-start text-sm font-semibold">Author Name</Label>
          <Input
            placeholder="Name"
            disabled={Boolean(defaultValues.uri)}
            defaultValue={author?.name}
            className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:text-sm placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
          />
        </TextField>
        <TextField name="authorEmail" className="flex w-full flex-col gap-1 px-0.5" isRequired>
          <Label className="text-start text-sm font-semibold">Author Email</Label>
          <Input
            placeholder="Email"
            disabled={Boolean(defaultValues.uri)}
            defaultValue={author?.email}
            className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:text-sm placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
          />
        </TextField>
      </div>
      <div className="flex items-center justify-between gap-2">
        <TextField name="username" className="flex w-full flex-col gap-1 px-0.5" isRequired>
          <Label className="text-start text-sm font-semibold">Username</Label>
          <Input
            placeholder="MyUser"
            disabled={Boolean(defaultValues.uri)}
            defaultValue={credentials?.username}
            onChange={e => setCredentials({ ...credentials, username: e.currentTarget.value })}
            className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:text-sm placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
          />
        </TextField>
        <TextField name="token" className="flex w-full flex-col gap-1 px-0.5" isRequired>
          <Label className="text-start text-sm font-semibold">
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
            disabled={Boolean(defaultValues.uri)}
            onChange={e => setCredentials({ ...credentials, password: e.currentTarget.value })}
            defaultValue={'password' in credentials ? credentials?.password : ''}
            placeholder="88e7ee63b254e4b0bf047559eafe86ba9dd49507"
            className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:text-sm placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
          />
        </TextField>
      </div>
      <GitRemoteBranchSelect
        credentials={{
          password: credentials.password,
          username: credentials.username,
        }}
        url={uri || ''}
        isDisabled={Boolean(defaultValues.uri)}
      />
    </form>
  );
};
