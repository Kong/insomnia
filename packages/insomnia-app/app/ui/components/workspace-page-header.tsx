import React, { FunctionComponent, ReactNode, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { ACTIVITY_HOME, GlobalActivity } from '../../common/constants';
import { isDesign } from '../../models/workspace';
import { selectActiveProjectName } from '../redux/selectors';
import { ActivityToggle } from './activity-toggle';
import { AppHeader } from './app-header';
import { WorkspaceDropdown } from './dropdowns/workspace-dropdown';
import type { WrapperProps } from './wrapper';

interface Props {
  wrapperProps: WrapperProps;
  handleActivityChange: (options: {workspaceId?: string; nextActivity: GlobalActivity}) => Promise<void>;
  gridRight: ReactNode;
}

export const WorkspacePageHeader: FunctionComponent<Props> = ({
  gridRight,
  handleActivityChange,
  wrapperProps: {
    activeApiSpec,
    activeWorkspace,
    activeWorkspaceName,
    activeProject,
    activeEnvironment,
    settings,
    activity,
    isLoading,
  },
}) => {
  const homeCallback = useCallback(
    () => handleActivityChange({ workspaceId: activeWorkspace?._id, nextActivity: ACTIVITY_HOME }),
    [activeWorkspace, handleActivityChange],
  );
  const activeProjectName = useSelector(selectActiveProjectName);

  if (!activeWorkspace || !activeApiSpec || !activity) {
    return null;
  }

  const workspace = (
    <WorkspaceDropdown
      key="workspace-dd"
      activeEnvironment={activeEnvironment}
      activeWorkspace={activeWorkspace}
      activeWorkspaceName={activeWorkspaceName}
      activeApiSpec={activeApiSpec}
      activeProject={activeProject}
      hotKeyRegistry={settings.hotKeyRegistry}
      isLoading={isLoading}
    />
  );

  const crumbs = [
    { id: 'project', node: activeProjectName, onClick: homeCallback },
    { id: 'workspace', node: workspace },
  ];

  return (
    <AppHeader
      breadcrumbProps={{ crumbs }}
      gridCenter={
        isDesign(activeWorkspace) && (
          <ActivityToggle
            activity={activity}
            handleActivityChange={handleActivityChange}
            workspace={activeWorkspace}
          />
        )
      }
      gridRight={gridRight}
    />
  );
};
