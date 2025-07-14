import React, { type FC } from 'react';
import { useRouteLoaderData } from 'react-router';

import { isGitProject, isRemoteProject } from '../../../models/project';
import { useOrganizationPermissions } from '../../hooks/use-organization-features';
import { useRootLoaderData } from '../../routes/root';
import type { WorkspaceLoaderData } from '../../routes/workspace';
import { GitProjectSyncDropdown } from './git-project-sync-dropdown';
import { GitSyncDropdown } from './git-sync-dropdown';
import { LocalProjectBar } from './local-project-bar';
import { SyncDropdown } from './sync-dropdown';

export const WorkspaceSyncDropdown: FC = () => {
  const { activeProject, activeWorkspace, gitRepository, activeWorkspaceMeta } = useRouteLoaderData(
    ':workspaceId',
  ) as WorkspaceLoaderData;

  const { userSession } = useRootLoaderData();

  const { features } = useOrganizationPermissions();

  if (!userSession.id) {
    return null;
  }

  const isLocalProject =
    !isRemoteProject(activeProject) && !activeWorkspaceMeta?.gitRepositoryId && !isGitProject(activeProject);

  if (isLocalProject) {
    return <LocalProjectBar />;
  }

  const shouldShowCloudSyncDropdown = isRemoteProject(activeProject) && !activeWorkspaceMeta?.gitRepositoryId;

  if (shouldShowCloudSyncDropdown) {
    return <SyncDropdown key={activeWorkspace?._id} workspace={activeWorkspace} project={activeProject} />;
  }

  const shouldShowGitSyncDropdown =
    features.gitSync.enabled && (activeWorkspaceMeta?.gitRepositoryId || !isRemoteProject(activeProject));
  if (shouldShowGitSyncDropdown) {
    if (isGitProject(activeProject)) {
      return <GitProjectSyncDropdown key={gitRepository?._id} gitRepository={gitRepository} />;
    }

    if (gitRepository) {
      return (
        <GitSyncDropdown
          key={gitRepository?._id}
          isInsomniaSyncEnabled={isRemoteProject(activeProject)}
          gitRepository={gitRepository}
          showDeprecatedWarning={!isGitProject(activeProject)}
        />
      );
    }
  }

  return null;
};
