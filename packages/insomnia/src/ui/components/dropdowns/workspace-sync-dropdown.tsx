import { FC } from 'react';
import React from 'react';
import { useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import { isRemoteProject } from '../../../models/project';
import { useVCS } from '../../hooks/use-vcs';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { GitSyncDropdown } from './git-sync-dropdown';
import { SyncDropdown } from './sync-dropdown';

const SidebarListItemContent = styled.div<{
  level: number;
}>(props => ({
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--padding-sm)',
  paddingLeft: `calc(var(--padding-md) * ${props.level || 1})`,
  boxSizing: 'border-box',
  position: 'relative',
}));

const StyledSidebarListItemTitle = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--padding-sm)',
});

export const WorkspaceSyncDropdown: FC = () => {
  const {
    activeProject,
    activeWorkspace,
    gitRepository,
  } = useRouteLoaderData(
    ':workspaceId'
  ) as WorkspaceLoaderData;

  const vcs = useVCS({
    workspaceId: activeWorkspace?._id,
  });

  console.log({
    activeProject,
    activeWorkspace,
    gitRepository,
  });

  if (isRemoteProject(activeProject) && vcs && !activeWorkspace?.gitSync) {
    return (
      <SyncDropdown
        key={activeWorkspace?._id}
        workspace={activeWorkspace}
        project={activeProject}
        vcs={vcs}
      />
    );
  }

  if (activeWorkspace?.gitSync || !isRemoteProject(activeProject)) {
    return <GitSyncDropdown isInsomniaSyncEnabled={isRemoteProject(activeProject)} gitRepository={gitRepository} />;
  }

  return null;
};
