import { models } from 'insomnia-data';
import React, { type FC } from 'react';

import { useWorkspaceLoaderData } from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useOrganizationPermissions } from '../../hooks/use-organization-features';
import { GitProjectSyncDropdown } from './git-project-sync-dropdown';
import { GitSyncDropdown } from './git-sync-dropdown';

export const WorkspaceSyncDropdown: FC = () => {
  const { activeProject, gitRepository, activeWorkspaceMeta } = useWorkspaceLoaderData()!;

  const { features } = useOrganizationPermissions();

  const isLocalProject =
    !activeWorkspaceMeta?.gitRepositoryId &&
    !models.project.isGitProject(activeProject);

  if (isLocalProject) {
    return null;
  }

  const shouldShowGitSyncDropdown =
    features.gitSync.enabled &&
    (activeWorkspaceMeta?.gitRepositoryId || true);
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
          isInsomniaSyncEnabled={false}
          gitRepository={gitRepository}
          showDeprecatedWarning={!models.project.isGitProject(activeProject)}
        />
      );
    }
  }

  return null;
};
