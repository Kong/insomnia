import React, { FunctionComponent, ReactNode, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { ACTIVITY_HOME } from '../../common/constants';
import { isDesign } from '../../models/workspace';
import { selectActiveProjectName } from '../redux/selectors';
import { ActivityToggle } from './activity-toggle';
import { AppHeader } from './app-header';
import { WorkspaceDropdown } from './dropdowns/workspace-dropdown';
import { HandleActivityChange } from './wrapper';

interface Props {
  handleActivityChange: HandleActivityChange;
  gridRight: ReactNode;
}

export const WorkspacePageHeader: FunctionComponent<Props> = ({
  gridRight,
  handleActivityChange,
  wrapperProps: {
    activeApiSpec,
    activeWorkspace,
    activity,
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

  const crumbs = [
    { id: 'project', node: activeProjectName, onClick: homeCallback },
    { id: 'workspace', node: <WorkspaceDropdown key="workspace-dd" /> },
  ];

  return (
    <AppHeader
      breadcrumbProps={{ crumbs }}
      gridCenter={<ActivityToggle handleActivityChange={handleActivityChange} />}
      gridRight={gridRight}
    />
  );
};
