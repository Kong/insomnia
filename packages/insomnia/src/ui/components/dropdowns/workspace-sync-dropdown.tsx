import { FC, useEffect } from 'react';
import React from 'react';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

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
  const { organizationId } = useParams() as { organizationId: string };
  const permissionsFetcher = useFetcher<OrganizationFeatureLoaderData>({ key: `permissions:${organizationId}` });

  useEffect(() => {
    const isIdleAndUninitialized = permissionsFetcher.state === 'idle' && !permissionsFetcher.data;
    if (isIdleAndUninitialized) {
      permissionsFetcher.load(`/organization/${organizationId}/permissions`);
    }
  }, [organizationId, permissionsFetcher]);

  const { features } = permissionsFetcher.data || {
    features: {
      gitSync: { enabled: false, reason: 'Insomnia API unreachable' },
    },
  };
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
