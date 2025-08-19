import React, { type FC } from 'react';

import type { StorageRules } from '~/models/organization';

import { ProjectSettingsForm } from '../project/project-settings-form';

interface Props {
  storageRules: StorageRules;
  isGitSyncEnabled: boolean;
}

export const NoProjectView: FC<Props> = ({ storageRules, isGitSyncEnabled }) => {
  return (
    <div className="flex h-full w-full flex-col items-center gap-3 pt-[15%] text-center">
      <span className="text-xl font-semibold">Welcome to your organization!</span>
      <span className="text-md">Create a new project to get started</span>
      <ProjectSettingsForm
        storageRules={storageRules}
        isGitSyncEnabled={isGitSyncEnabled}
        defaultProjectName="My first project"
      />
    </div>
  );
};
