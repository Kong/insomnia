import { FC } from 'react';
import React from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { isRemoteProject } from '../../../models/project';
import { OrganizationFeatureLoaderData } from '../../routes/organization';
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
  const { features } = useRouteLoaderData(':organizationId') as OrganizationFeatureLoaderData;

  if (!userSession.id) {
    return null;
  }

  const shouldShowCloudSyncDropdown = isRemoteProject(activeProject)
    && !activeWorkspaceMeta?.gitRepositoryId;

  if (shouldShowCloudSyncDropdown) {
    return (
      <SyncDropdown
        key={activeWorkspace?._id}
        workspace={activeWorkspace}
        project={activeProject}
        gitSyncEnabled={features.gitSync.enabled}
      />
    );
  }

  const shouldShowGitSyncDropdown = features.gitSync.enabled && (activeWorkspaceMeta?.gitRepositoryId || !isRemoteProject(activeProject));
  if (shouldShowGitSyncDropdown) {
    return <GitSyncDropdown isInsomniaSyncEnabled={isRemoteProject(activeProject)} gitRepository={gitRepository} />;
  }

  return null;
};
