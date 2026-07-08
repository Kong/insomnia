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
    <div className="h-full w-full overflow-y-auto text-(--color-font)">
      <div className="mx-auto flex w-[min(700px,100%)] flex-col gap-4 p-16">
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
    </div>
  );
};
