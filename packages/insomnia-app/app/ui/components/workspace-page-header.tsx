import { Breadcrumb, Header } from 'insomnia-components';
import React, { Fragment, FunctionComponent, ReactNode, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { ACTIVITY_HOME, GlobalActivity } from '../../common/constants';
import { isDesign } from '../../models/workspace';
import coreLogo from '../images/insomnia-core-logo.png';
import { selectActiveProjectName } from '../redux/selectors';
import { ActivityToggle } from './activity-toggle';
import SettingsButton from './buttons/settings-button';
import { AccountDropdown } from './dropdowns/account-dropdown';
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

  if (!activeWorkspace || !activeWorkspaceName || !activeApiSpec || !activity) {
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
    <Header
      className="app-header theme--app-header"
      gridLeft={
        <Fragment>
          <img src={coreLogo} alt="Insomnia" width="24" height="24" />
          <Breadcrumb crumbs={crumbs}/>
        </Fragment>
      }
      gridCenter={
        isDesign(activeWorkspace) && (
          <ActivityToggle
            activity={activity}
            handleActivityChange={handleActivityChange}
            workspace={activeWorkspace}
          />
        )
      }
      gridRight={
        <>
          {gridRight}
          <SettingsButton className="margin-left" />
          <AccountDropdown className="margin-left" />
        </>
      }
    />
  );
};
