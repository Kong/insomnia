import React, { FC, Fragment } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { GitRepository } from '../../models/git-repository';
import {  Project } from '../../models/project';
import { isDesign, Workspace } from '../../models/workspace';
import { WorkspaceMeta } from '../../models/workspace-meta';
import { ActivityToggle } from './activity-toggle';
import { Breadcrumb } from './breadcrumb';
import { WorkspaceDropdown } from './dropdowns/workspace-dropdown';

export const WorkspaceHeader: FC<{
  gitRepository: GitRepository | null;
  activeProject: Project;
  activeWorkspace: Workspace;
  activeWorkspaceMeta?: WorkspaceMeta;
}> = ({ activeProject, activeWorkspace }) => {
  const { organizationId, projectId, workspaceId } = useParams<{
    organizationId: string;
    projectId: string;
    workspaceId: string;
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

  if (!activeProject || !activeWorkspace || !workspaceId) {
    return null;
  }

  return (
    <Fragment>
      <Breadcrumb crumbs={crumbs} />
      {isDesign(activeWorkspace) && <ActivityToggle />}
    </Fragment>
  );
};
