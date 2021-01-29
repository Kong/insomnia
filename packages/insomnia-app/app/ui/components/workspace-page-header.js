// @flow

import React from 'react';
import { ACTIVITY_HOME, isInsomnia } from '../../common/constants';
import coreLogo from '../images/insomnia-core-logo.png';
import strings from '../../common/strings';
import WorkspaceDropdown from './dropdowns/workspace-dropdown';
import ActivityToggle from './activity-toggle';
import type { WrapperProps } from './wrapper';
import { Header, Breadcrumb } from 'insomnia-components';

type Props = {
  wrapperProps: WrapperProps,
  handleActivityChange: (workspaceId: string, activity: GlobalActivity) => Promise<void>,
  gridRight: React.Node,
};

const WorkspacePageHeader = ({
  gridRight,
  handleActivityChange,
  wrapperProps: {
    activeApiSpec,
    activeWorkspace,
    activeEnvironment,
    settings,
    activity,
    unseenWorkspaces,
    vcs,
    workspaces,
    isLoading,
    handleSetActiveWorkspace,
  },
}: Props) => {
  const insomnia = isInsomnia(activity);
  const designer = !insomnia;

  const homeCallback = React.useCallback(
    () => handleActivityChange(activeWorkspace._id, ACTIVITY_HOME),
    [activeWorkspace._id, handleActivityChange],
  );

  const workspace = (
    <WorkspaceDropdown
      displayName={insomnia ? activeWorkspace.name : activeApiSpec.fileName}
      activeEnvironment={activeEnvironment}
      activeWorkspace={activeWorkspace}
      workspaces={workspaces}
      unseenWorkspaces={unseenWorkspaces}
      hotKeyRegistry={settings.hotKeyRegistry}
      handleSetActiveWorkspace={handleSetActiveWorkspace}
      isLoading={isLoading}
      vcs={vcs}
    />
  );

  return (
    <Header
      className="app-header"
      gridLeft={
        <React.Fragment>
          <img src={coreLogo} alt="Insomnia" width="32" height="32" />
          <Breadcrumb
            className="breadcrumb"
            crumbs={[strings.workspaces, workspace]}
            onClick={homeCallback}
          />
        </React.Fragment>
      }
      gridCenter={
        designer && (
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

export default WorkspacePageHeader;
