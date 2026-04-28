import type { StorageRules } from 'insomnia-api';
import React, { type FC } from 'react';
import { Heading } from 'react-aria-components';

import { useGitCredentials } from '~/ui/hooks/use-git-credentials';

import { ProjectCreateForm } from '../project/project-create-form';

interface Props {
  storageRules: StorageRules;
}

export const NoProjectView: FC<Props> = ({ storageRules }) => {
  const { credentials, providers } = useGitCredentials();
  return (
    <div className="grid w-[min(700px,100%)] grid-rows-[min-content_1fr_min-content] place-items-stretch items-stretch gap-4 self-center overflow-hidden p-16">
      <div>
        <p className="mb-3 text-3xl font-semibold">Welcome to your organization!</p>
        <Heading className="mb-3">Create a new project to get started</Heading>
      </div>
      <ProjectCreateForm
        storageRules={storageRules}
        defaultProjectName="My first project"
        credentials={credentials}
        providers={providers}
      />
    </div>
  );
};
