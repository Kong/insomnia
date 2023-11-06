import { FC } from 'react';
import React from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { isLoggedIn } from '../../../account/session';
import { isRemoteProject } from '../../../models/project';
import vcs from '../../../sync/vcs/insomnia-sync';
import { FeatureList } from '../../routes/organization';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { GitSyncDropdown } from './git-sync-dropdown';
import { SyncDropdown } from './sync-dropdown';

export const WorkspaceSyncDropdown: FC = () => {
  const {
    activeProject,
    activeWorkspace,
    gitRepository,
    activeWorkspaceMeta,
  } = useRouteLoaderData(
    ':workspaceId'
  ) as WorkspaceLoaderData;

  const { features } = useRouteLoaderData(':organizationId') as { features: FeatureList };

  if (!isLoggedIn()) {
    return null;
  }

  if (isRemoteProject(activeProject) && vcs && !activeWorkspaceMeta?.gitRepositoryId) {
    return (
      <SyncDropdown
        key={activeWorkspace?._id}
        workspace={activeWorkspace}
        project={activeProject}
        gitSyncEnabled={features.gitSync.enabled}
        vcs={vcs}
      />
    );
  }

  if (features.gitSync.enabled && (activeWorkspaceMeta?.gitRepositoryId || !isRemoteProject(activeProject))) {
    return <GitSyncDropdown isInsomniaSyncEnabled={isRemoteProject(activeProject)} gitRepository={gitRepository} />;
  }

  return null;
};
