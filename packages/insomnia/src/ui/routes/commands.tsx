import type { LoaderFunction } from 'react-router-dom';

import { database } from '../../common/database';
import { fuzzyMatch } from '../../common/misc';
import { environment, grpcRequest, project, request, requestGroup, userSession, webSocketRequest, workspace } from '../../models';
import type { Environment } from '../../models/environment';
import type { GrpcRequest } from '../../models/grpc-request';
import { isScratchpadOrganizationId, type Organization } from '../../models/organization';
import { isRemoteProject, type Project } from '../../models/project';
import type { Request } from '../../models/request';
import type { RequestGroup } from '../../models/request-group';
import type { WebSocketRequest } from '../../models/websocket-request';
import { scopeToActivity, type Workspace } from '../../models/workspace';
import { invariant } from '../../utils/invariant';
import { insomniaFetch } from '../insomniaFetch';

export interface CommandItem<TItem> {
  id: string;
  url: string;
  name: string;
  organizationName: string;
  projectName: string;
  workspaceName?: string;
  item: TItem;
}

export interface LoaderResult {
  current: {
    requests: CommandItem<(Request | GrpcRequest | WebSocketRequest)>[];
    files: CommandItem<Workspace & { teamProjectId: string }>[];
    environments: Environment[];
  };
  other: {
    requests: CommandItem<(Request | GrpcRequest | WebSocketRequest)>[];
    files: CommandItem<Workspace & { teamProjectId: string }>[];
  };
}

export const loader: LoaderFunction = async args => {
  const searchParams = new URL(args.request.url).searchParams;
  const organizationId = searchParams.get('organizationId');
  invariant(organizationId, 'organizationId is required');
  const projectId = searchParams.get('projectId');
  invariant(projectId, 'projectId is required');
  const workspaceId = searchParams.get('workspaceId');
  const filter = searchParams.get('filter');
  const requestFilter = (request: Request | WebSocketRequest | GrpcRequest) => {
    if (!filter) {
      return true;
    }
    return Boolean(fuzzyMatch(
      filter || '',
      [request.name, request.url, request.description].join(' '),
      { splitSpace: false, loose: true }
    )?.indexes);
  };

  const { accountId } = await userSession.getOrCreate();

  const allOrganizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];

  const allOrganizationsIds = isScratchpadOrganizationId(organizationId) ? [organizationId] : allOrganizations.map(org => org.id);

  const allProjects = await database.find<Project>(project.type, {
    parentId: { $in: allOrganizationsIds },
  });

  const allProjectIds = allProjects.map(project => project._id);

  const allOrganizationWorkspaces = await database.find<Workspace>(workspace.type, {
    parentId: { $in: allProjectIds },
  });

  const workspaceIds = allOrganizationWorkspaces.map(workspace => workspace._id);

  const parentReferences = new Map<string, {
    type: 'Project' | 'Workspace' | 'RequestGroup' | 'Request' | 'GrpcRequest' | 'WebSocketRequest';
    organizationId: string;
    projectId?: string;
    workspaceId?: string;
  }>();

  allProjects.forEach(project => {
    parentReferences.set(project._id, {
      type: 'Project',
      organizationId: project.parentId,
      projectId: project._id,
    });
  });

  allOrganizationWorkspaces.forEach(workspaceId => {
    parentReferences.set(workspaceId._id, {
      type: 'Workspace',
      organizationId: parentReferences.get(workspaceId.parentId)!.organizationId,
      projectId: workspaceId.parentId,
      workspaceId: workspaceId._id,
    });
  });

  const getRequestGroups = async ({ $in }: { $in: string[]; root?: boolean }): Promise<RequestGroup[]> => {
    const requestGroups = await database.find<RequestGroup>(requestGroup.type, {
      parentId: {
        $in,
      },
    });

    for (const requestGroup of requestGroups) {
      parentReferences.set(requestGroup._id, {
        type: 'RequestGroup',
        organizationId: parentReferences.get(requestGroup.parentId)!.organizationId,
        projectId: parentReferences.get(requestGroup.parentId)!.projectId,
        workspaceId: parentReferences.get(requestGroup.parentId)!.workspaceId,
      });
    }

    const requestGroupIds = requestGroups.map(requestGroup => requestGroup._id);

    const childRequestGroups = requestGroupIds.length > 0 ? await getRequestGroups({
      $in: requestGroupIds,
    }) : [];

    for (const requestGroup of childRequestGroups) {
      parentReferences.set(requestGroup._id, {
        type: 'RequestGroup',
        organizationId: parentReferences.get(requestGroup.parentId)!.organizationId,
        projectId: parentReferences.get(requestGroup.parentId)!.projectId,
        workspaceId: parentReferences.get(requestGroup.parentId)!.workspaceId,
      });
    }

    return [
      ...requestGroups,
      ...childRequestGroups,
    ];
  };

  const allRequestGroups = await getRequestGroups({
    $in: workspaceIds,
  });

  const requests = await database.find<Request>(request.type, {
    parentId: {
      $in: [
        ...workspaceIds,
        ...allRequestGroups.map(requestGroup => requestGroup._id),
      ],
    },
  });

  for (const request of requests) {
    parentReferences.set(request._id, {
      type: 'Request',
      organizationId: parentReferences.get(request.parentId)!.organizationId,
      projectId: parentReferences.get(request.parentId)!.projectId,
      workspaceId: parentReferences.get(request.parentId)!.workspaceId,
    });
  }

  const grpcRequests = await database.find<GrpcRequest>(grpcRequest.type, {
    parentId: {
      $in: [
        ...workspaceIds,
        ...allRequestGroups.map(requestGroup => requestGroup._id),
      ],
    },
  });

  for (const grpcRequest of grpcRequests) {
    parentReferences.set(grpcRequest._id, {
      type: 'GrpcRequest',
      organizationId: parentReferences.get(grpcRequest.parentId)!.organizationId,
      projectId: parentReferences.get(grpcRequest.parentId)!.projectId,
      workspaceId: parentReferences.get(grpcRequest.parentId)!.workspaceId,
    });
  }

  const webSocketRequests = await database.find<WebSocketRequest>(webSocketRequest.type, {
    parentId: {
      $in: [
        ...workspaceIds,
        ...allRequestGroups.map(requestGroup => requestGroup._id),
      ],
    },
  });

  for (const webSocketRequest of webSocketRequests) {
    parentReferences.set(webSocketRequest._id, {
      type: 'WebSocketRequest',
      organizationId: parentReferences.get(webSocketRequest.parentId)!.organizationId,
      projectId: parentReferences.get(webSocketRequest.parentId)!.projectId,
      workspaceId: parentReferences.get(webSocketRequest.parentId)!.workspaceId,
    });
  }

  const allRequests = [...requests, ...grpcRequests, ...webSocketRequests];

  const [baseEnvironment] = await database.find<Environment>(environment.type, {
    parentId: workspaceId,
  });

  const subEnvironments = await database.find<Environment>(environment.type, {
    parentId: baseEnvironment?._id,
  });

  const environments = baseEnvironment ? [
    baseEnvironment,
    ...subEnvironments,
  ] : [];

  const currentRequests = allRequests.filter(request => {
    return parentReferences.get(request.parentId)!.workspaceId === workspaceId;
  });

  const otherRequests = allRequests.filter(request => {
    return parentReferences.get(request.parentId)!.workspaceId !== workspaceId;
  });

  const currentFiles = allOrganizationWorkspaces.filter(workspace => {
    return workspace.parentId === projectId;
  });

  const otherFiles = allOrganizationWorkspaces.filter(workspace => {
    return workspace.parentId !== projectId;
  });

  return {
    current: {
      requests: currentRequests.filter(requestFilter).slice(0, 100).map(item => ({
        id: item._id,
        url: `/organization/${parentReferences.get(item.parentId)?.organizationId}/project/${parentReferences.get(item.parentId)!.projectId}/workspace/${parentReferences.get(item.parentId)?.workspaceId}/debug/request/${item._id}`,
        name: item.name,
        item,
        organizationName: allOrganizations.find(org => org.id === parentReferences.get(item.parentId)?.organizationId)?.display_name || '',
        projectName: allProjects.find(project => project._id === parentReferences.get(item.parentId)?.projectId)?.name || '',
        workspaceName: allOrganizationWorkspaces.find(workspace => workspace._id === parentReferences.get(item.parentId)?.workspaceId)?.name || '',
      })),
      files: currentFiles.map(workspace => {
        const parentProject = allProjects.find(project => project._id === workspace.parentId);
        return ({
          id: workspace._id,
          url: `/organization/${parentReferences.get(workspace.parentId)?.organizationId}/project/${parentReferences.get(workspace.parentId)?.projectId}/workspace/${workspace._id}/${scopeToActivity(workspace.scope)}`,
          name: workspace.name,
          item: { ...workspace, teamProjectId: parentProject && isRemoteProject(parentProject) ? parentProject.remoteId : '' },
          organizationName: allOrganizations.find(org => org.id === parentReferences.get(workspace.parentId)?.organizationId)?.display_name || '',
          projectName: allProjects.find(project => project._id === parentReferences.get(workspace.parentId)?.projectId)?.name || '',
        });
      }),
      environments,
    },
    other: {
      requests: otherRequests.filter(requestFilter).slice(0, 100).map(item => ({
        id: item._id,
        url: `/organization/${parentReferences.get(item.parentId)?.organizationId}/project/${parentReferences.get(item.parentId)?.projectId}/workspace/${parentReferences.get(item.parentId)!.workspaceId}/debug/request/${item._id}`,
        name: item.name,
        item,
        organizationName: allOrganizations.find(org => org.id === parentReferences.get(item.parentId)?.organizationId)?.display_name || '',
        projectName: allProjects.find(project => project._id === parentReferences.get(item.parentId)?.projectId)?.name || '',
        workspaceName: allOrganizationWorkspaces.find(workspace => workspace._id === parentReferences.get(item.parentId)?.workspaceId)?.name || '',
      })),
      files: otherFiles.map(workspace => {
        const parentProject = allProjects.find(project => project._id === workspace.parentId);
        return ({
          id: workspace._id,
          url: `/organization/${parentReferences.get(workspace.parentId)?.organizationId}/project/${parentReferences.get(workspace.parentId)?.projectId}/workspace/${workspace._id}/${scopeToActivity(workspace.scope)}`,
          name: workspace.name,
          item: { ...workspace, teamProjectId: parentProject && isRemoteProject(parentProject) ? parentProject.remoteId : '' },
          organizationName: allOrganizations.find(org => org.id === parentReferences.get(workspace.parentId)?.organizationId)?.display_name || '',
          projectName: allProjects.find(project => project._id === parentReferences.get(workspace.parentId)?.projectId)?.name || '',
        });
      }),
    },
  };
};

export interface CommandRemoteItem<TItem> {
  id: string;
  url: string;
  pullUrl: string;
  name: string;
  organizationName: string;
  projectName: string;
  workspaceName?: string;
  item: TItem;
}

interface RemoteFile {
  id: string;
  name: string;
  projectId: string;
  teamProjectId: string;
  organizationId: string;
}

export interface RemoteFilesLoaderResult {
  files: CommandRemoteItem<RemoteFile & { teamProjectLocalId: string; scope: 'unsynced' }>[];
}

export const remoteFilesLoader: LoaderFunction = async (): Promise<RemoteFilesLoaderResult> => {
  const { id: sessionId, accountId } = await userSession.get();

  if (!sessionId) {
    return {
      files: [],
    };
  }

  try {
    const remoteFiles = await insomniaFetch<RemoteFile[]>({
      method: 'GET',
      path: '/v1/user/files',
      sessionId,
    });

    const allOrganizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];

    const allRemoteFilesOrganizationIds = remoteFiles.map(file => file.organizationId);
    const allRemoteFilesProjectIds = remoteFiles.map(file => file.teamProjectId);

    const organizations = allOrganizations.filter(org => allRemoteFilesOrganizationIds.includes(org.id));

    const projects = await database.find<Project>(project.type, {
      remoteId: {
        $in: allRemoteFilesProjectIds,
      },
    });

    const files = remoteFiles.map(file => {
      const parentProject = projects.find(project => project.remoteId === file.teamProjectId);
      return {
        id: file.id,
        url: `/organization/${file.organizationId}`,
        pullUrl: parentProject ? `/organization/${file.organizationId}/project/${file.teamProjectId}/remote-collections/pull` : '',
        name: file.name,
        item: { ...file, teamProjectLocalId: parentProject?._id || '', scope: 'unsynced' as const },
        organizationName: organizations.find(org => org.id === file.organizationId)?.display_name || '',
        projectName: parentProject?.name || '',
      };
    });

    return {
      files,
    };
  } catch (err) {
    return {
      files: [],
    };
  }
};
