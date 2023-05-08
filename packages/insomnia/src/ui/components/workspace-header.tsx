import React, { FC, Fragment } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { GitRepository } from '../../models/git-repository';
import { isRemoteProject, Project } from '../../models/project';
import { isDesign, Workspace } from '../../models/workspace';
import { WorkspaceMeta } from '../../models/workspace-meta';
import { VCS } from '../../sync/vcs/vcs';
import { useVCS } from '../hooks/use-vcs';
import { ActivityToggle } from './activity-toggle';
import { Breadcrumb } from './breadcrumb';
import { GitSyncDropdown } from './dropdowns/git-sync-dropdown';
import { SyncDropdown } from './dropdowns/sync-dropdown';
import { WorkspaceDropdown } from './dropdowns/workspace-dropdown';

const WorkspaceSyncDropdown: FC<{
  activeProject: Project;
  activeWorkspace: Workspace;
  workspaceId: string;
  vcs: VCS | null;
  gitRepository: GitRepository | null;
}> = ({ activeProject, activeWorkspace, workspaceId, vcs, gitRepository }) => {
  if (isRemoteProject(activeProject) && vcs && !activeWorkspace?.gitSync) {
    return (
      <SyncDropdown
        key={workspaceId}
        workspace={activeWorkspace}
        project={activeProject}
        vcs={vcs}
      />
    );
  }

  if (activeWorkspace?.gitSync) {
    return <GitSyncDropdown gitRepository={gitRepository} />;
  }

  return null;
};

export const WorkspaceHeader: FC<{
  gitRepository: GitRepository | null;
  activeProject: Project;
  activeWorkspace: Workspace;
  activeWorkspaceMeta?: WorkspaceMeta;
}> = ({ gitRepository, activeProject, activeWorkspace }) => {
  const { organizationId, projectId, workspaceId } = useParams<{
    organizationId: string;
    projectId: string;
    workspaceId: string;
  }>();

  const vcs = useVCS({
    workspaceId,
  });

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
      <WorkspaceSyncDropdown
        activeProject={activeProject}
        activeWorkspace={activeWorkspace}
        workspaceId={workspaceId}
        vcs={vcs}
        gitRepository={gitRepository}
      />
    </Fragment>
  );
};
