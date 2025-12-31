import React, { type FC, useEffect } from 'react';
import { Heading } from 'react-aria-components';

import type { StorageRules } from '~/models/organization';
import { useGitCredentialsLoaderFetcher } from '~/routes/git-credentials';

import { ProjectCreateForm } from '../project/project-create-form';

interface Props {
  storageRules: StorageRules;
  isGitSyncEnabled: boolean;
}

export const NoProjectView: FC<Props> = ({ storageRules, isGitSyncEnabled }) => {
  const credentialsFetcher = useGitCredentialsLoaderFetcher();

  useEffect(() => {
    if (credentialsFetcher.state === 'idle' && !credentialsFetcher.data) {
      credentialsFetcher.load();
    }
  }, [credentialsFetcher]);

  const { credentials = [], providers = [] } = credentialsFetcher.data || {};
  return (
    <div className="grid w-[min(var(--container-xl),100%)] grid-rows-[min-content_1fr_min-content] place-items-stretch items-stretch gap-4 self-center overflow-hidden p-16">
      <div>
        <p className="mb-3 text-3xl font-semibold">Welcome to your organization!</p>
        <Heading className="mb-3">Create a new project to get started</Heading>
      </div>
      <ProjectCreateForm
        storageRules={storageRules}
        isGitSyncEnabled={isGitSyncEnabled}
        defaultProjectName="My first project"
        credentials={credentials}
        providers={providers}
      />
    </div>
  );
};
