import React, { type FC } from 'react';

import { models } from '~/insomnia-data';
import { useRootLoaderData } from '~/root';

import { useWorkspaceLoaderData } from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useOrganizationPermissions } from '../../hooks/use-organization-features';
import { GitProjectSyncDropdown } from './git-project-sync-dropdown';
import { GitSyncDropdown } from './git-sync-dropdown';
import { LocalProjectBar } from './local-project-bar';
import { SyncDropdown } from './sync-dropdown';

export const WorkspaceSyncDropdown: FC = () => {
  const { activeProject, activeWorkspace, gitRepository, activeWorkspaceMeta } = useWorkspaceLoaderData()!;

  const { userSession } = useRootLoaderData()!;

  const { features } = useOrganizationPermissions();

  if (!userSession.id) {
    return null;
  }

  const isLocalProject =
    !models.project.isRemoteProject(activeProject) &&
    !activeWorkspaceMeta?.gitRepositoryId &&
    !models.project.isGitProject(activeProject);

  if (isLocalProject) {
    return <LocalProjectBar />;
  }

  const shouldShowCloudSyncDropdown =
    models.project.isRemoteProject(activeProject) && !activeWorkspaceMeta?.gitRepositoryId;

  if (shouldShowCloudSyncDropdown) {
    return <SyncDropdown key={activeWorkspace?._id} workspace={activeWorkspace} project={activeProject} />;
  }

  const shouldShowGitSyncDropdown =
    features.gitSync.enabled &&
    (activeWorkspaceMeta?.gitRepositoryId || !models.project.isRemoteProject(activeProject));
  if (shouldShowGitSyncDropdown) {
    if (models.project.isGitProject(activeProject)) {
      return (
        <GitProjectSyncDropdown key={gitRepository?._id} gitRepository={gitRepository} activeProject={activeProject} />
      );
    }

    if (gitRepository) {
      return (
        <GitSyncDropdown
          key={gitRepository?._id}
          isInsomniaSyncEnabled={models.project.isRemoteProject(activeProject)}
          gitRepository={gitRepository}
          showDeprecatedWarning={!models.project.isGitProject(activeProject)}
        />
      );
    }
  }

  return null;
};
