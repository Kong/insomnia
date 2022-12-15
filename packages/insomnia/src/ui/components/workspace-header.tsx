import React, { FC, Fragment } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { GitRepository } from '../../models/git-repository';
import { isRemoteProject, Project } from '../../models/project';
import { isCollection, isDesign, Workspace } from '../../models/workspace';
import { useVCS } from '../hooks/use-vcs';
import { ActivityToggle } from './activity-toggle';
import { Breadcrumb } from './breadcrumb';
import { GitSyncDropdown } from './dropdowns/git-sync-dropdown';
import { SyncDropdown } from './dropdowns/sync-dropdown';
import { WorkspaceDropdown } from './dropdowns/workspace-dropdown';

export const WorkspaceHeader: FC<{
  gitRepository: GitRepository | null;
  activeProject: Project;
  activeWorkspace: Workspace;
}> = ({
  gitRepository,
  activeProject,
  activeWorkspace,
}) => {
  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();

  const vcs = useVCS({
    workspaceId,
  });

  const navigate = useNavigate();

  const crumbs = [
    {
      onClick: () => navigate(`/organization/${organizationId}/project/${projectId}`),
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
      {isDesign(activeWorkspace) && <GitSyncDropdown gitRepository={gitRepository} />}
      {isCollection(activeWorkspace) && isRemoteProject(activeProject) && vcs && <SyncDropdown key={workspaceId} workspace={activeWorkspace} project={activeProject} vcs={vcs} />}
    </Fragment>
  );
};
