import React from 'react';
import { LoaderFunction, Outlet, useLoaderData } from 'react-router-dom';

import { database } from '../../common/database';
import * as models from '../../models';
import { GitRepository } from '../../models/git-repository';
import { Project } from '../../models/project';
import { Workspace } from '../../models/workspace';
import { WorkspaceMeta } from '../../models/workspace-meta';
import { invariant } from '../../utils/invariant';

export interface WorkspaceLoaderData {
  activeWorkspace: Workspace;
  activeWorkspaceMeta?: WorkspaceMeta;
  activeProject: Project;
  gitRepository: GitRepository | null;
}

export const workspaceLoader: LoaderFunction = async ({
  params,
}): Promise<WorkspaceLoaderData> => {
  const { projectId, workspaceId } = params;
  invariant(workspaceId, 'Workspace ID is required');
  invariant(projectId, 'Project ID is required');

  const workspace = await models.workspace.getById(workspaceId);

  invariant(workspace, 'Workspace not found');

  const workspaceEnvironments = await models.environment.findByParentId(workspaceId);
  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);
  const cookieJar = await models.cookieJar.getOrCreateForParentId(workspaceId);
  const apiSpec = await models.apiSpec.getByParentId(workspaceId);
  const activeProject = await models.project.getById(projectId);
  invariant(activeProject, 'Project not found');

  const gitRepository = await models.gitRepository.getById(workspaceMeta.gitRepositoryId || '');

  const workspaceHasChildren = workspaceEnvironments.length && cookieJar && apiSpec && workspaceMeta;
  if (!workspaceHasChildren) {
    const flushId = await database.bufferChanges();
    await models.workspace.ensureChildren(workspace);
    await database.flushChanges(flushId);
  }

  return {
    activeWorkspace: workspace,
    activeProject,
    gitRepository,
    activeWorkspaceMeta: workspaceMeta,
  };
};

const WorkspaceRoute = () => {
  const workspaceData = useLoaderData() as WorkspaceLoaderData;
  const branch = workspaceData.activeWorkspaceMeta?.cachedGitRepositoryBranch;
  return <Outlet key={branch} />;
};

export default WorkspaceRoute;
