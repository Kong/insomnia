import { FC } from 'react';
import React from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { isRemoteProject } from '../../../models/project';
import { FeatureList, StorageType } from '../../routes/organization';
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
  const { features, storage } = useRouteLoaderData(':organizationId') as { features: FeatureList; storage: StorageType };

  if (!userSession.id) {
    return null;
  }

  const isCloudSyncEnabled = storage === 'cloud_only' || storage === 'cloud_plus_local';
  const isLocalVaultEnabled = storage === 'local_only' || storage === 'cloud_plus_local';

  if (isRemoteProject(activeProject) && !activeWorkspaceMeta?.gitRepositoryId && isCloudSyncEnabled) {
    return (
      <SyncDropdown
        key={activeWorkspace?._id}
        workspace={activeWorkspace}
        project={activeProject}
        gitSyncEnabled={features.gitSync.enabled}
      />
    );
  }

  if (features.gitSync.enabled && (activeWorkspaceMeta?.gitRepositoryId || (!isRemoteProject(activeProject) || isLocalVaultEnabled))) {
    return <GitSyncDropdown isInsomniaSyncEnabled={isRemoteProject(activeProject) && isCloudSyncEnabled} gitRepository={gitRepository} />;
  }

  return null;
};
