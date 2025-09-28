import React, { type FunctionComponent } from 'react';
import { FieldError, Form, Input, Label, TextField } from 'react-aria-components';

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
  const isReadOnly = Boolean(gitRepository?.uri);
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
    <Form
      id="custom"
      className="group/form grid grid-cols-2 gap-4"
      onSubmit={event => {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);
        onSubmit({
          uri: (formData.get('uri') as string) || '',
          credentials: {
            username: (formData.get('username') as string) || '',
            password: (formData.get('password') as string) || '',
          },
          author: {
            name: (formData.get('authorName') as string) || '',
            email: (formData.get('authorEmail') as string) || '',
          },
        });
      }}
    >
      <TextField
        name="uri"
        type="url"
        autoFocus
        defaultValue={uri}
        onChange={value => setUri(value)}
        isReadOnly={isReadOnly}
        className="col-span-2 flex w-full flex-col gap-1 px-0.5"
        isRequired
      >
        <Label className="text-start text-sm font-semibold">Git URI (http/https, including .git suffix)</Label>
        <Input
          placeholder="https://github.com/org/repo.git"
          className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:text-sm placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
        />
        <FieldError className="text-xs text-[--color-danger]">
          {({ isInvalid }) =>
            isInvalid ? 'Please ensure the URL is valid. In most cases it should also end with a .git suffix.' : null
          }
        </FieldError>
      </TextField>
      <TextField
        name="authorName"
        isReadOnly={isReadOnly}
        defaultValue={author?.name}
        className="flex w-full flex-col gap-1 px-0.5"
        isRequired
      >
        <Label className="text-start text-sm font-semibold">Author Name</Label>
        <Input
          placeholder="Name"
          className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:text-sm placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
        />
        <FieldError className="text-xs text-[--color-danger]" />
      </TextField>
      <TextField
        name="authorEmail"
        type="email"
        isReadOnly={isReadOnly}
        defaultValue={author?.email}
        className="flex w-full flex-col gap-1 px-0.5"
        isRequired
      >
        <Label className="text-start text-sm font-semibold">Author Email</Label>
        <Input
          placeholder="Email"
          className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:text-sm placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
        />
        <FieldError className="text-xs text-[--color-danger]" />
      </TextField>
      <TextField
        name="username"
        isReadOnly={isReadOnly}
        defaultValue={credentials?.username}
        onChange={value => setCredentials({ ...credentials, username: value })}
        className="flex w-full flex-col gap-1 px-0.5"
        isRequired
      >
        <Label className="text-start text-sm font-semibold">Username</Label>
        <Input
          placeholder="MyUserName"
          className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:text-sm placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
        />
        <FieldError className="text-xs text-[--color-danger]" />
      </TextField>
      <TextField
        name="password"
        type="password"
        isReadOnly={isReadOnly}
        onChange={value => setCredentials({ ...credentials, password: value })}
        defaultValue={'password' in credentials ? credentials?.password : ''}
        className="flex w-full flex-col gap-1 px-0.5"
        isRequired
      >
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
          placeholder="88e7ee63b254e4b0bf047559eafe86ba9dd49507"
          className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:text-sm placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
        />
        <FieldError className="text-xs text-[--color-danger]" />
      </TextField>
      <div className="col-span-2">
        <GitRemoteBranchSelect
          credentials={{
            password: credentials.password,
            username: credentials.username,
          }}
          url={uri || ''}
          isDisabled={isReadOnly}
        />
      </div>
    </Form>
  );
};
