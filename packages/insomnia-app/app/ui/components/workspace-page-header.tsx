import { Breadcrumb, Header } from 'insomnia-components';
import React, { Fragment, FunctionComponent, ReactNode, useCallback } from 'react';

import { ACTIVITY_HOME, GlobalActivity } from '../../common/constants';
import { strings } from '../../common/strings';
import { isCollection, isDesign } from '../../models/workspace';
import coreLogo from '../images/insomnia-core-logo.png';
import ActivityToggle from './activity-toggle';
import SettingsButton from './buttons/settings-button';
import AccountDropdown from './dropdowns/account-dropdown';
import WorkspaceDropdown from './dropdowns/workspace-dropdown';
import type { WrapperProps } from './wrapper';

interface Props {
  wrapperProps: WrapperProps;
  handleActivityChange: (options: {workspaceId?: string, nextActivity: GlobalActivity}) => Promise<void>;
  gridRight: ReactNode;
}

const WorkspacePageHeader: FunctionComponent<Props> = ({
  gridRight,
  handleActivityChange,
  wrapperProps: {
    activeApiSpec,
    activeWorkspace,
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

  if (!activeWorkspace || !activeApiSpec || !activity) {
    return null;
  }

  const collection = isCollection(activeWorkspace);
  const design = isDesign(activeWorkspace);

  const workspace = (
    <WorkspaceDropdown
      displayName={collection ? activeWorkspace.name : activeApiSpec.fileName}
      activeEnvironment={activeEnvironment}
      activeWorkspace={activeWorkspace}
      activeApiSpec={activeApiSpec}
      activeProject={activeProject}
      hotKeyRegistry={settings.hotKeyRegistry}
      isLoading={isLoading}
    />
  );

  const crumbs = [
    { id: 'home', node: strings.home.singular, onClick: homeCallback },
    { id: 'workspace', node: <Fragment key="workspace-dd">{workspace}</Fragment> },
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
        design && (
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

export default WorkspacePageHeader;
