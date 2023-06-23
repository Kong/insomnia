import React from 'react';
import { LoaderFunction, Outlet, useLoaderData } from 'react-router-dom';

import { database as db } from '../../common/database';
import * as models from '../../models';
import { GitRepository } from '../../models/git-repository';
import { isGrpcRequest } from '../../models/grpc-request';
import { Project } from '../../models/project';
import { isRequest } from '../../models/request';
import { isWebSocketRequest } from '../../models/websocket-request';
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

  // I don't know what to say man, this is just how it is
  await models.environment.getOrCreateForParentId(workspaceId);
  await models.cookieJar.getOrCreateForParentId(workspaceId);
  await models.workspaceMeta.getOrCreateByParentId(workspaceId);
  let workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);
  const activeProject = await models.project.getById(projectId);
  invariant(activeProject, 'Project not found');

  const gitRepository = await models.gitRepository.getById(workspaceMeta.gitRepositoryId || '');
  if (!workspaceMeta.activeRequestId) {
    // TODO: review this
    const requests = (await db.withDescendants(workspace, models.request.type)).filter(r => isRequest(r) || isWebSocketRequest(r) || isGrpcRequest(r)).sort((a, b) => b.metaSortKey - a.metaSortKey);
    if (requests.length) {
      workspaceMeta = await models.workspaceMeta.update(workspaceMeta, { activeRequestId: requests[0]._id });
    }
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
