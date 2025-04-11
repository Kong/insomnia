import React, { type FC } from 'react';

import type { StorageRules } from '../../routes/organization';
import { ProjectSettingsForm } from '../project/project-settings-form';

interface Props {
  storageRules: StorageRules;
  isGitSyncEnabled: boolean;
}

export const NoProjectView: FC<Props> = ({
  storageRules,
  isGitSyncEnabled,
}) => {
  return (
    <div className='flex flex-col items-center pt-[15%] w-full h-full text-center gap-3'>
      <span className='font-semibold text-xl'>Welcome to your organization!</span>
      <span className='text-md'>Create a new project to get started</span>
      <ProjectSettingsForm storageRules={storageRules} isGitSyncEnabled={isGitSyncEnabled} defaultProjectName="My first project" />
    </div>
  );
};
