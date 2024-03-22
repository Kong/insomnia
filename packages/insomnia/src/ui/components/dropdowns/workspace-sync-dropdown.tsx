import { FC } from 'react';
import React from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { isRemoteProject } from '../../../models/project';
import { FeatureList } from '../../routes/organization';
import { useRootLoaderData } from '../../routes/root';
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

  const { userSession } = useRootLoaderData();
  const { features } = useRouteLoaderData(':organizationId') as { features: FeatureList };

  if (!userSession.id) {
    return null;
  }

  if (isRemoteProject(activeProject) && !activeWorkspaceMeta?.gitRepositoryId) {
    return (
      <SyncDropdown
        key={activeWorkspace?._id}
        workspace={activeWorkspace}
        project={activeProject}
        gitSyncEnabled={features.gitSync.enabled}
      />
    );
  }

  if (features.gitSync.enabled && (activeWorkspaceMeta?.gitRepositoryId || !isRemoteProject(activeProject))) {
    return <GitSyncDropdown isInsomniaSyncEnabled={isRemoteProject(activeProject)} gitRepository={gitRepository} />;
  }

  return null;
};
