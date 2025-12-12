import React, { type FC } from 'react';

import type { StorageRules } from '~/models/organization';

import { ProjectCreateForm } from '../project/project-create-form';

interface Props {
  storageRules: StorageRules;
  isGitSyncEnabled: boolean;
}

export const NoProjectView: FC<Props> = ({ storageRules, isGitSyncEnabled }) => {
  return (
    <div className="h-full overflow-y-auto px-8 pt-16">
      <div className="max-h-full text-center">
        <p className="mb-3 text-xl font-semibold">Welcome to your organization!</p>
        <p className="mb-3">Create a new project to get started</p>
        <div className="mx-auto flex max-w-2xl justify-center pb-16">
          <ProjectCreateForm
            storageRules={storageRules}
            isGitSyncEnabled={isGitSyncEnabled}
            defaultProjectName="My first project"
          />
        </div>
      </div>
    </div>
  );
};
