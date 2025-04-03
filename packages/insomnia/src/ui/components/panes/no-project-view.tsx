import type { FC } from 'react';
import React from 'react';

import { ORG_STORAGE_RULE } from '../../routes/organization';
import { ProjectSettingsForm } from '../project/project-settings-form';

interface Props {
  storageRule: ORG_STORAGE_RULE;
  isGitSyncEnabled: boolean;
}

export const NoProjectView: FC<Props> = ({
  storageRule,
  isGitSyncEnabled,
}) => {
  return (
    <div className='flex flex-col items-center pt-[15%] w-full h-full text-center gap-3'>
      <span className='font-semibold text-xl'>Welcome to your organization!</span>
      <span className='text-md'>Create a new project to get started</span>
      <ProjectSettingsForm storageRule={storageRule} isGitSyncEnabled={isGitSyncEnabled} defaultProjectName="My first project" />
    </div>
  );
};
