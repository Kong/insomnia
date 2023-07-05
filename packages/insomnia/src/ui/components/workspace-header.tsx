import React, { FC, Fragment } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {  Project } from '../../models/project';
import { isDesign, Workspace } from '../../models/workspace';
import { ActivityToggle } from './activity-toggle';
import { Breadcrumb } from './breadcrumb';
import { WorkspaceDropdown } from './dropdowns/workspace-dropdown';

export const WorkspaceHeader: FC<{
  activeProject: Project;
  activeWorkspace: Workspace;
}> = ({ activeProject, activeWorkspace }) => {
  const { organizationId, projectId } = useParams<{
    organizationId: string;
    projectId: string;
  }>();

  const navigate = useNavigate();

  const crumbs = [
    {
      onClick: () =>
        navigate(`/organization/${organizationId}/project/${projectId}`),
      id: activeProject._id,
      label: activeProject.name,
      node: <span data-testid="project">{activeProject.name}</span>,
    },
    {
      id: activeWorkspace._id,
      label: activeWorkspace.name,
      node: <WorkspaceDropdown />,
    },
  ];

  return (
    <Fragment>
      <Breadcrumb crumbs={crumbs} />
      {isDesign(activeWorkspace) && <ActivityToggle />}
    </Fragment>
  );
};
